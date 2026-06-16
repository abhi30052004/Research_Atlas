import logging
import json
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException
from openai import AsyncOpenAI
from groq import AsyncGroq

from app.core.config import settings
from app.core.database import get_db
from app.models.artifact import ArtifactType
from app.models.analytics import EventType
from app.models.source import ProcessingStatus
from app.services.rag_service import rag_service
from app.services.analytics_service import analytics_service

logger = logging.getLogger(__name__)

GROQ_MODELS = set() # {"llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama3-70b-8192"} disabled per user request

# Artifact types that return structured JSON — parsed separately from prose outputs
JSON_ARTIFACT_TYPES = {
    ArtifactType.DATA_TABLE,
    ArtifactType.SLIDE_DECK,
    ArtifactType.MIND_MAP,
    ArtifactType.FLASHCARDS,
    ArtifactType.QUIZ,
}

ARTIFACT_PROMPTS = {

    ArtifactType.SUMMARY: """
You are a research analyst working for Atlas AI. Using ONLY the source chunks provided below, write a comprehensive executive summary.

Structure your output with these exact sections:
1. **Overview** (2-3 sentences capturing the core subject and scope)
2. **Key Findings** (5-7 bullet points, each grounded in a specific source)
3. **Main Themes** (2-3 thematic sections with 1-2 paragraphs each)
4. **Conclusions & Implications** (what this means for the reader or business)
5. **Source Coverage** (briefly note which sources contributed most)

Rules:
- Do NOT add information not present in the provided sources.
- Cite sources inline using [Source: <filename>] format after each claim.
- Write in formal, professional English.
- Length: 400–600 words.
""",

    ArtifactType.RESEARCH_REPORT: """
You are a senior research writer at Atlas AI. Using ONLY the source chunks provided below, produce a structured research report.

Structure your output with these exact sections:
1. **Title** (concise and descriptive, derived from source content)
2. **Abstract** (150 words max summarizing purpose, scope, and key findings)
3. **Introduction** (background, research context, why this topic matters)
4. **Key Findings** (organized by theme or sub-topic with source citations)
5. **Analysis** (patterns, contradictions, or gaps identified across sources)
6. **Conclusion** (summary of insights and recommended next steps)
7. **References** (list all source filenames used)

Rules:
- Ground every claim in the provided sources.
- Use inline citations: [Source: <filename>].
- Maintain an objective, analytical tone throughout.
- Length: 700–1000 words.
""",

    ArtifactType.BLOG_OUTLINE: """
You are a content strategist at Atlas AI. Using the source chunks provided below, create a detailed blog post outline.

Structure your output as follows:
1. **3 Headline Options** (attention-grabbing, SEO-friendly titles based on source content)
2. **Target Audience** (who this post is for, in one sentence)
3. **Introduction Hook** (2-3 opening sentences that create curiosity or tension)
4. **Main Sections** (4-6 sections, each with):
   - Section heading (H2 style)
   - 3-5 sub-points or talking points as short phrases
   - Suggested source reference: [Source: <filename>]
5. **Conclusion** (key takeaway + 1 clear CTA idea)
6. **Suggested Tags/Keywords** (5-7 terms derived from source content)

Rules:
- All content must be derivable from the provided sources.
- Keep sub-points as short action-oriented phrases, not full paragraphs.
- Do not fabricate statistics or claims not found in the sources.
""",

    ArtifactType.FAQ: """
You are a knowledge base editor at Atlas AI. Using ONLY the source chunks provided below, generate a comprehensive FAQ document.

Format each item exactly as:
**Q: <Question>**
**A:** <Detailed answer in 2-4 sentences> [Source: <filename>]

Rules:
- Generate exactly 12-15 Q&A pairs.
- Order questions from foundational to advanced.
- Cover: definitions, how-it-works, benefits, edge cases, and common concerns found in the sources.
- Do not invent questions or answers beyond what the sources support.
- Use plain, clear language suitable for a non-expert reader.
- Do not repeat the same point across multiple answers.
""",

    ArtifactType.SOP: """
You are a business process expert at Atlas AI. Using the source chunks provided below, create a Standard Operating Procedure (SOP) document.

Structure your output with these exact sections:
1. **Document Title**
2. **Purpose** (why this SOP exists — 2-3 sentences)
3. **Scope** (who this applies to and what it covers)
4. **Roles & Responsibilities** (who does what, in bullet format)
5. **Prerequisites** (tools, access, or knowledge required before starting)
6. **Step-by-Step Procedure** (numbered steps; each step = action + expected outcome)
7. **Quality Checkpoints** (verification steps or approval gates after key stages)
8. **Troubleshooting** (2-4 common issues and resolutions from the sources)
9. **References** (source filenames used)

Rules:
- Use imperative verbs for each step ("Open...", "Verify...", "Submit...").
- Be specific — avoid vague instructions like "handle appropriately."
- Derive all steps and checkpoints only from the provided sources.
- Cite sources inline: [Source: <filename>].
""",

    ArtifactType.COMPARISON_REPORT: """
You are a research analyst at Atlas AI. Using the source chunks provided below, create a structured comparison report.

Structure your output as follows:
1. **Comparison Title** (what is being compared, derived from sources)
2. **Comparison Table** (Markdown table — criteria in rows, items/options in columns; include 6-10 meaningful criteria)
3. **Item-by-Item Analysis** (one short paragraph per item covering key strengths and weaknesses)
4. **Pros & Cons Summary** (bullet list of pros and cons for each item)
5. **Recommendation** (clear, reasoned conclusion on which option suits which use case)
6. **Data Sources** (which source filenames informed each section)

Rules:
- Only compare items and criteria explicitly present in the provided sources.
- Use [Source: <filename>] for any specific data point or claim.
- Keep the recommendation objective and evidence-based — no unsupported opinions.
""",

    ArtifactType.DATA_TABLE: """
You are a data analyst at Atlas AI. Extract all quantitative and factual data from the source chunks below and return it as a structured JSON array.

Return ONLY valid JSON — no markdown code fences, no explanation, no preamble:
[
  {
    "metric": "<what is being measured>",
    "value": "<the number, stat, or fact>",
    "unit": "<unit of measurement, or null if not applicable>",
    "context": "<1-sentence explanation of what this data point means>",
    "source": "<filename>"
  }
]

Rules:
- Include every distinct data point, statistic, percentage, date, count, or measurable fact found in the sources.
- Do not invent or estimate values not explicitly stated in the sources.
- If two sources cite the same metric with different values, create separate rows for each.
- Return ONLY the JSON array. No text before or after it.
""",

    ArtifactType.SLIDE_DECK: """
You are a presentation designer at Atlas AI. Using the source chunks provided below, create a complete slide deck outline.

Return ONLY valid JSON — no markdown code fences, no explanation, no preamble:
[
  {
    "slide_number": 1,
    "slide_type": "title | agenda | section | content | data | quote | summary | q_and_a",
    "title": "<slide title>",
    "bullets": ["<point 1>", "<point 2>", "<point 3>"],
    "speaker_notes": "<2-4 sentences the presenter should say for this slide>",
    "source_reference": "<filename or null>"
  }
]

Follow this slide sequence exactly:
- Slide 1: Title slide
- Slide 2: Agenda / Overview
- Slides 3-9: Content slides (one major theme per slide, derived from sources)
- Slide 10: Key Takeaways
- Slide 11: Recommendations or Next Steps
- Slide 12: Q&A / Thank You

Rules:
- Create a polished business presentation structure, not a document pasted into slides.
- Every slide title must be specific and presentation-ready.
- Maximum 5 bullets per slide; each bullet must be under 12 words.
- Use parallel bullet phrasing and avoid full paragraphs in bullets.
- Speaker notes must add context not visible in the bullets.
- Include source_reference on every evidence-based slide.
- Derive all content from the provided sources only.
- Return ONLY the JSON array. No text before or after it.
""",

    ArtifactType.MIND_MAP: """
You are a knowledge architect at Atlas AI. Using the source chunks provided below, create a structured mind map.

Return ONLY valid JSON in this exact format — no markdown code fences, no explanation, no preamble:
{
  "topic": "<central subject derived from sources>",
  "branches": [
    {
      "name": "<main branch / theme>",
      "color": "<hex color code, e.g. #4A90D9>",
      "children": [
        {
          "name": "<sub-topic>",
          "children": [
            { "name": "<supporting detail or fact>" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Create 4-7 main branches representing the major themes across the sources.
- Each branch must have 3-5 children; children may have 2-3 grandchildren.
- All nodes must be grounded in the provided sources.
- Node names must be concise (2-6 words maximum).
- Assign a distinct hex color to each top-level branch.
- Return ONLY the JSON object. No text before or after it.
""",

    ArtifactType.FLASHCARDS: """
You are an instructional designer at Atlas AI. Using the source chunks provided below, generate study flashcards.

Return ONLY valid JSON — no markdown code fences, no explanation, no preamble:
[
  {
    "id": 1,
    "front": "<concise question or term — never a paragraph>",
    "back": "<clear, complete answer or definition in 1-3 sentences>",
    "category": "<topic area this card belongs to>",
    "card_type": "definition | concept | process | fact",
    "source": "<filename>"
  }
]

Rules:
- Generate exactly 18 flashcards.
- Mix card types: definitions (30%), concept explanations (30%), process/how-it-works (20%), facts/stats (20%).
- Group cards across 4-6 meaningful categories.
- Front must be a question or incomplete statement — never a paragraph.
- Back must be self-contained and fully answer the front.
- Keep each back answer concise enough to fit on a study card.
- Cover all major concepts from the sources; do not cluster around one topic.
- Return ONLY the JSON array. No text before or after it.
""",

    ArtifactType.QUIZ: """
You are an assessment designer at Atlas AI. Using the source chunks provided below, create a multiple-choice quiz.

Return ONLY valid JSON — no markdown code fences, no explanation, no preamble:
[
  {
    "id": 1,
    "question": "<clear, unambiguous question based on source content>",
    "options": {
      "A": "<option text>",
      "B": "<option text>",
      "C": "<option text>",
      "D": "<option text>"
    },
    "correct_answer": "A",
    "explanation": "<why this answer is correct, referencing source content>",
    "difficulty": "easy | medium | hard",
    "source": "<filename>"
  }
]

Rules:
- Generate exactly 10 questions.
- Distribute difficulty: 3 easy, 5 medium, 2 hard.
- Questions must progress from foundational recall to applied understanding.
- All questions and correct answers must be grounded in the provided sources.
- Distractors (wrong options) must be plausible but clearly incorrect based on source content.
- Explanations must reference specific information from the sources.
- Keep option text similar in length so the correct answer is not obvious by formatting.
- Return ONLY the JSON array. No text before or after it.
""",

    ArtifactType.INFOGRAPHIC_CONTENT: """
You are a visual content strategist at Atlas AI. Using the source chunks provided below, produce structured infographic content.

Structure your output with these exact sections:
1. **Headline** (punchy, 6-10 words)
2. **Sub-headline** (one sentence expanding on the headline)
3. **Key Statistics** (5-7 data points in this format: "STAT — Context sentence" e.g. "73% — of teams report reduced research time after adopting AI tools")
4. **Main Sections** (4-5 visual content blocks, each with):
   - Icon Suggestion (e.g. 🔍 Research, 📊 Data, ⚙️ Process)
   - Section Title (3-5 words)
   - Visual Data Point or Key Fact (1 sentence)
   - Supporting Detail (1-2 sentences)
   - [Source: <filename>]
5. **Process Flow** (if a process is described in sources): 4-6 numbered steps as short action phrases
6. **Key Takeaways** (3 punchy closing statements, one sentence each)
7. **Call to Action** (one clear next step for the reader)

Rules:
- All statistics and facts must come directly from the provided sources.
- Write for visual scanning — short phrases, not dense paragraphs.
- Cite [Source: <filename>] next to any specific stat or claim.
- Do not fabricate data points not present in the sources.
""",

    ArtifactType.AUDIO_OVERVIEW_SCRIPT: """
You are a podcast scriptwriter at Atlas AI. Using the source chunks provided below, write a natural, engaging audio overview script designed to be read aloud.

Structure your script exactly as follows:
[INTRO - 30 sec]
<Hook that tells the listener what they will learn and why it matters>

[SEGMENT 1 - 45-60 sec]
<First major topic or theme from sources — spoken naturally>

[TRANSITION]
<One bridging sentence leading into the next segment>

[SEGMENT 2 - 45-60 sec]
<Second major topic or theme from sources>

[TRANSITION]
<One bridging sentence leading into the next segment>

[SEGMENT 3 - 45-60 sec]
<Third major topic, key insight, or data highlight from sources>

[OUTRO - 30 sec]
<Summary of the 2-3 most important takeaways + closing thought>

Speaker cue rules — insert these inline where appropriate:
- [PAUSE] — after key statements
- [EMPHASIS] — on critical words or numbers
- [SLOWER] — when explaining a complex idea
- [FASTER] — during transitions or lists

Content rules:
- Total script must read aloud in 3-5 minutes (~450-750 words at natural speaking pace).
- Write in flowing spoken prose — use contractions, short sentences, conversational rhythm.
- Do NOT use bullet points anywhere in the final script.
- Ground all content in the provided sources.
- Prioritize the most surprising or insight-rich material for the opening hook.
- Cite sources naturally in speech: "According to <filename>..." or "The research shows..."
""",

}


class ArtifactService:
    def _get_client(self, model: str):
        if model in GROQ_MODELS:
            return AsyncGroq(api_key=settings.GROQ_API_KEY), "groq"
        return AsyncOpenAI(api_key=settings.OPENAI_API_KEY), "openai"

    def _parse_content(self, artifact_type: ArtifactType, raw_text: str):
        """
        For JSON artifact types, strip markdown fences and parse.
        For prose types, return the raw text string as-is.
        """
        if artifact_type not in JSON_ARTIFACT_TYPES:
            return raw_text

        # Strip markdown code fences if model wrapped the JSON anyway
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]          # drop opening fence line
            cleaned = cleaned.rsplit("```", 1)[0].strip() # drop closing fence

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning(
                "JSON parse failed for artifact type %s: %s — returning raw text",
                artifact_type.value, e,
            )
            return raw_text

    async def generate(
        self,
        workspace_id: str,
        user_id: str,
        artifact_type: ArtifactType,
        title: Optional[str],
        source_ids: Optional[List[str]],
        custom_prompt: Optional[str],
        model: str,
    ) -> dict:
        db = get_db()
        ws = await db.workspaces.find_one({"_id": workspace_id, "user_id": user_id})
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")

        source_query = {"workspace_id": workspace_id, "user_id": user_id}
        requested_source_ids = source_ids or []
        if requested_source_ids:
            source_query["_id"] = {"$in": requested_source_ids}

        sources = []
        async for source in db.sources.find(source_query):
            sources.append(source)

        if requested_source_ids:
            found_source_ids = {source["_id"] for source in sources}
            missing_source_ids = [source_id for source_id in requested_source_ids if source_id not in found_source_ids]
            if missing_source_ids:
                raise HTTPException(status_code=404, detail="One or more selected sources were not found.")

        if not sources:
            raise HTTPException(
                status_code=400,
                detail="No source documents are available. Please upload PDF, DOCX, TXT, or web URL sources first, then try generating again.",
            )

        pending_sources = [
            source for source in sources
            if source.get("status") in {ProcessingStatus.PENDING.value, ProcessingStatus.PROCESSING.value}
        ]
        failed_sources = [
            source for source in sources
            if source.get("status") == ProcessingStatus.FAILED.value
        ]
        ready_source_ids = [
            source["_id"] for source in sources
            if source.get("status") == ProcessingStatus.COMPLETED.value and source.get("chunk_count", 0) > 0
        ]

        if requested_source_ids and pending_sources:
            raise HTTPException(
                status_code=409,
                detail="One or more selected sources are still processing. Please wait until processing completes, then try generating again.",
            )

        if requested_source_ids and failed_sources:
            failed_names = ", ".join(source.get("original_name") or source.get("filename") or "Untitled" for source in failed_sources[:3])
            raise HTTPException(
                status_code=422,
                detail=f"One or more selected sources failed to process: {failed_names}. Please delete or re-upload them before generating.",
            )

        if not ready_source_ids:
            if pending_sources:
                raise HTTPException(
                    status_code=409,
                    detail="Your uploaded sources are still processing. Please wait until they show as processed, then try generating again.",
                )
            if failed_sources:
                raise HTTPException(
                    status_code=422,
                    detail="Uploaded sources failed to process. Please delete or re-upload them before generating.",
                )
            raise HTTPException(
                status_code=422,
                detail="Uploaded sources were processed, but no readable text chunks were found. Please upload a text-based PDF, DOCX, TXT, or web URL source.",
            )

        query = title or artifact_type.value.replace("_", " ")
        retrieved_docs = await rag_service.retrieve(
            workspace_id, query, top_k=10,
            source_ids=ready_source_ids,
        )

        if not retrieved_docs:
            raise HTTPException(
                status_code=503,
                detail="Sources are uploaded, but no indexed chunks were retrieved yet. Please try again in a moment, or re-upload the source if this continues.",
            )

        system_content = (
            "You are Atlas AI, an expert research assistant that creates high-quality, "
            "structured documents strictly grounded in the source material provided by the user. "
            "Never invent facts, statistics, or claims not present in the sources."
        )

        context_parts = [
            f"[Source: {doc.get('filename', 'Unknown')}]\n{doc['content']}"
            for doc in retrieved_docs
        ]
        context = "\n\n---\n\n".join(context_parts)

        base_prompt = ARTIFACT_PROMPTS.get(
            artifact_type,
            "Generate well-structured content based on the provided sources. Cite sources inline using [Source: <filename>].",
        )
        if custom_prompt:
            base_prompt = f"{base_prompt}\n\nAdditional instructions from user: {custom_prompt}"

        full_prompt = f"{base_prompt}\n\n---\n\nSOURCE CHUNKS:\n{context}"

        client, client_type = self._get_client(model)

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0.3,
            max_tokens=4000,
        )

        raw_text = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0

        content = self._parse_content(artifact_type, raw_text)

        citations = await rag_service.generate_citations(retrieved_docs, db)
        doc_title = title or f"{artifact_type.value.replace('_', ' ').title()} - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"

        artifact_id = str(ObjectId())
        doc = {
            "_id": artifact_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "artifact_type": artifact_type.value,
            "title": doc_title,
            "content": content,
            "citations": citations,
            "source_ids": ready_source_ids,
            "model_used": model,
            "tokens_used": tokens_used,
            "generation_prompt": base_prompt,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.artifacts.insert_one(doc)
        await db.workspaces.update_one(
            {"_id": workspace_id},
            {"$inc": {"artifact_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        await analytics_service.track(
            user_id,
            EventType.ARTIFACT_GENERATED,
            workspace_id,
            model_used=model,
            tokens_used=tokens_used,
            metadata={"artifact_type": artifact_type.value},
        )
        doc["id"] = artifact_id
        return doc

    async def get_by_id(self, artifact_id: str, user_id: str) -> dict:
        db = get_db()
        artifact = await db.artifacts.find_one({"_id": artifact_id, "user_id": user_id})
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        artifact["id"] = str(artifact["_id"])
        return artifact

    async def list_by_workspace(self, workspace_id: str, user_id: str) -> list:
        db = get_db()
        cursor = db.artifacts.find(
            {"workspace_id": workspace_id, "user_id": user_id}
        ).sort("created_at", -1)
        results = []
        async for a in cursor:
            a["id"] = str(a["_id"])
            results.append(a)
        return results

    async def delete(self, artifact_id: str, user_id: str) -> None:
        db = get_db()
        artifact = await db.artifacts.find_one({"_id": artifact_id, "user_id": user_id})
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        await db.artifacts.delete_one({"_id": artifact_id})
        await db.workspaces.update_one(
            {"_id": artifact["workspace_id"]},
            {"$inc": {"artifact_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )


artifact_service = ArtifactService()
