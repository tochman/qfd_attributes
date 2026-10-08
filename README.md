# QFD Customer Attributes

JavaScript rebuild of [ai_qfd_customer_attributes](https://github.com/tochman/ai_qfd_customer_attributes).
Turns a list of customer statements into a Quality Function Deployment (QFD) report:

1. **Classify**: the LLM checks each statement for domain relevance and scores its sentiment (-1..+1).
2. **Attributes**: the LLM assigns each statement to a primary > secondary > tertiary attribute path.
3. **Importance**: each primary attribute's share of total absolute sentiment, in %.
4. **Analysis**: the LLM writes the intro, QFD method, analysis, recommendations and conclusion.
5. **Output**: `out/report.html` (print to PDF from the browser) and `out/attributes.json`.

Works with Claude (set `LLM_MODEL=claude-...` and `ANTHROPIC_API_KEY`) or any OpenAI-compatible endpoint, including the free ones (Gemini, Groq, OpenRouter, local Ollama). Model replies are cached in `.cache/`, so a failed run resumes where it stopped.

## Setup

```bash
npm install
cp .env.example .env   # then pick a provider and add its key
```

## Run

```bash
npm start -- --domain "Healthcare Services" --input data/survey.txt --details data/survey_details.txt
```

Input: one statement per line. Details: free text about the survey (company, respondents, date, project lead).

## Test

```bash
npm test
```
