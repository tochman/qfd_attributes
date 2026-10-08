# QFD Customer Attributes

Turns a list of customer comments into a **Quality Function Deployment (QFD)** report, using a large
language model (LLM) for the reading and sorting work a QFD team would otherwise do by hand.

JavaScript rebuild of [ai_qfd_customer_attributes](https://github.com/tochman/ai_qfd_customer_attributes).

## What is QFD?

Quality Function Deployment is a method for making sure that what a company builds or offers is driven
by what customers actually want. The idea is to capture the **Voice of the Customer** (the needs customers
express in their own words) and carry it, step by step, all the way to design and operational decisions.

Yoji Akao developed QFD in Japan in the late 1960s. It was first used at Mitsubishi Heavy Industries' Kobe
shipyard in 1972, then adopted by Toyota, and reached Western industry (Ford, Xerox) in the 1980s. Today it
is used in product development, software and services such as healthcare.

### The House of Quality

QFD's best-known tool is the **House of Quality**, a matrix that links customer needs to the technical
characteristics a company can control:

```
                    ┌──────────────┐
                   /  correlations  \        how the technical characteristics
                  /   (the "roof")   \       affect each other
                 ├────────────────────┤
                 │     technical      │      HOW will we meet the needs?
                 │  characteristics   │      (e.g. "booking takes < 2 min")
  ┌──────────────┼────────────────────┼─────────────┐
  │   customer   │                    │ competitive │
  │  attributes  │   relationships    │ assessment  │
  │   (WHAT)     │      matrix        │             │
  │  + weights   │                    │             │
  └──────────────┼────────────────────┼─────────────┘
                 │ targets/priorities │
                 └────────────────────┘
```

Everything in the house starts from the left-hand side: **the customer attributes and how important each
one is.** That's the part this project automates.

### Customer attributes

Customers rarely state their needs neatly. They say things like *"I waited forever on the phone"* or
*"the website was easy to use"*. A QFD team collects these statements and groups them into a hierarchy,
often using an affinity diagram:

| Level | Meaning | Example |
|---|---|---|
| **Primary** | Broad, strategic need | Access & Scheduling |
| **Secondary** | More specific need | Phone Responsiveness |
| **Tertiary** | Concrete, detailed need, close to the customer's own words | Hold Time |

Each attribute then gets an **importance weight**, so the team knows which needs matter most. In classic
QFD the weights come from asking customers to rate each need, for example from 1 to 5.

### What this tool does

The steps a QFD team would do in workshops, done with an LLM:

1. **Relevance and sentiment.** Each statement is checked for relevance to the domain (off-topic comments
   are dropped) and given a sentiment score from -1 (very negative) to +1 (very positive).
2. **Attribute hierarchy.** Each statement is placed under a primary > secondary > tertiary attribute.
3. **Importance.** Each primary attribute's weight is its share of the total *absolute* sentiment, in %.
   A strongly worded comment counts for more than a lukewarm one, whether it's praise or complaint.
4. **Business analysis.** The LLM writes an introduction, explains the method, analyses the findings and
   gives recommendations.
5. **Report.** `report.html` (print to PDF from the browser) and `attributes.json` with the full hierarchy.

The tool stops at the customer side of the house. Turning the attributes into technical characteristics,
filling in the relationships matrix and setting targets is left to you, and makes a good exercise.

## Questions to discuss

- **Importance from sentiment.** This tool uses the strength of feeling as a stand-in for importance.
  When does that work, and when does it mislead? (Hint: people rarely write about things that simply work,
  like a hospital being clean, yet those needs can be critical. Look up the Kano model.)
- **AI as the analyst.** Run the same data set twice. Does the hierarchy stay the same? What does that
  say about how far you can trust one run?
- **Relevance filter.** The `--domain` setting decides which comments count. Try a narrower or broader
  domain and compare the reports.
- **Next room of the house.** Pick three tertiary attributes from a report and write measurable
  technical characteristics for them.

## Setup

You need [Node.js](https://nodejs.org) 20.6 or newer and an API key for a language model.

```bash
npm install
cp .env.example .env
```

Then open `.env` and pick a provider:

- **Google Gemini (free).** Get a key at https://aistudio.google.com/apikey. The free tier allows about
  20 requests per model per day, and a run takes about 5, so a few runs a day.
- **Claude (paid, a few cents per run).** Create a key inside a workspace at https://console.anthropic.com
  and set `LLM_MODEL` to e.g. `claude-haiku-4-5` (cheapest) or `claude-opus-5-5`.
- **Groq, OpenRouter or a local model with Ollama** also work; see `.env.example`.

## Run

Four sample data sets are included. See [data/instructions.md](data/instructions.md) for a command
for each one. For example:

```bash
npm start -- --domain "Healthcare Services" --input data/survey.txt --details data/survey_details.txt --out out/survey
open out/survey/report.html
```

To use your own data: put one customer statement per line in a text file, and write a short details file
about the survey (who commissioned it, how many respondents, date, project lead).

Model replies are saved in `.cache/`, so if a run fails partway (for example on a rate limit), running the
same command again picks up where it stopped. Delete `.cache/` to get fresh answers.

## Code

| File | What it does |
|---|---|
| `src/index.js` | Command line entry point, runs the steps in order |
| `src/llm.js` | Prompts for each step, calls the model, retries and caching |
| `src/qfd.js` | Builds the attribute tree and calculates importance (no AI) |
| `src/report.js` | Renders the HTML report |

## Test

```bash
npm test
```

## Further reading

- J. R. Hauser and D. Clausing, "The House of Quality", *Harvard Business Review*, 1988.
- Y. Akao, *Quality Function Deployment: Integrating Customer Requirements into Product Design*, 1990.
