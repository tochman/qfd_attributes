# Running the sample data sets

There are three data sets. Each has a statements file (one statement per line) and a details file
(company, respondents, date, project lead). Run the commands from the project root after setting up
`.env` (see the main README). Each run writes `report.html` and `attributes.json` into its `--out` folder.

## 1. Healthcare clinic survey (MedPlus AB, 188 statements, English)

```bash
npm start -- --domain "Healthcare Services" --input data/survey.txt --details data/survey_details.txt --out out/survey
```

## 2. Mobile vaccination clinic (VaccineOnTheGo AB, 22 statements, English)

```bash
npm start -- --domain "Mobile Vaccination Services" --input data/vaccine.txt --details data/vaccine_details.txt --out out/vaccine
```

## 3. Staff workplace survey (Exempel AB, 26 statements, Swedish)

```bash
npm start -- --domain "Workplace Environment and Employee Wellbeing" --input data/staff.txt --details data/staff_details.txt --out out/staff
```

The prompts are in English, so this report comes out in English even though the statements are Swedish.

## Notes

- `--domain` is used to filter out statements that aren't about the subject. If too many statements
  get dropped, use a broader domain.
- Model replies are cached in `.cache/`. Rerunning the same command after a failure only calls the
  model for the steps that didn't finish. Delete `.cache/` to get fresh answers.
- Open a report with `open out/survey/report.html` (macOS).
