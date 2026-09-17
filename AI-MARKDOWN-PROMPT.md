Convert the resume, career notes, or work history I provide into a master Markdown profile that Folio Resume Builder can read.

Before writing the file, ask for missing essential information, especially my name. Do not invent employers, dates, skills, metrics, qualifications, clearance, citizenship, or accomplishments. Preserve the facts and distinguish earned certifications from those in progress. Do not infer that an old certification is still active. For missing optional fields, omit them. Keep all relevant experience in the master profile; Folio lets me select content later.

OUTPUT RULES

- Return only the Markdown file contents, without an outer code fence, preamble, or explanation. If file creation is available, save it as master-profile.md using UTF-8.
- Use exactly one top-level heading: # My Full Name.
- Use only these second-level section headings, in this order when information exists: ## Basic Info, ## Summary, ## Skills, ## Experience, ## Projects, ## Education, ## Certifications, ## Certifications in Progress.
- Do not create extra sections such as Awards, Training, Publications, Volunteering, or Teaching. Ask me where to place such information within the supported sections when needed. Teaching and volunteer positions can be entries under Experience when appropriate.
- Basic Info: one field per line, using - Label: Value. Include only supplied contact/eligibility information. Do not put my name here a second time. Avoid unnecessary sensitive identifiers such as Social Security numbers.
- Summary: one short plain-text paragraph grounded in my supplied experience. Do not add bullet markers or a job title heading here.
- Skills: use comma-separated items, optionally grouped as - Networking: TCP/IP, DNS, VLANs. Do not put commas inside a single skill name; Folio treats commas and semicolons as separators. Include only supported skills.
- Experience, Projects, Education, and both Certification sections: every entry MUST start with a third-level heading, for example ### Job Title | Employer. A pipe is plain display text, not a table.
- Put dates, location, credential issuer, project URLs, and other metadata on plain lines immediately after the entry heading. Do not prefix metadata with a bullet. For federal resumes, preserve supplied hours per week, grade/series, and other requested job metadata as plain lines under the relevant job. Do not invent these fields.
- Put each achievement on its own line beginning with - . Keep it one level deep and on one physical line. Rephrase only to clarify; preserve metrics and meaning.
- Append tags to EACH Experience and Project achievement: <!-- tags: network, cyber -->. Use a comma-separated list of lowercase tags, preferably short words or hyphenated phrases. Tag only what the bullet actually supports. Reuse consistent tags across jobs, such as network, cyber, cloud, systems, automation, software, data, support, leadership, training. A bullet may have several tags. Do not automatically tag every bullet with every category.
- Put teaching achievements in Experience and tag them training when supported. Education bullets may also have tags. Credentials must remain under Education or Certifications so they stay individually selectable.
- Do not use Markdown tables, YAML front matter, images, embedded HTML layouts, nested lists, checkboxes, or headings deeper than ###. The only HTML needed is the inline tag comment. Use plain URLs rather than link markup when possible.
- Omit empty sections and all example placeholders from the final file. Never copy the fictional facts below into my profile.

FORMAT EXAMPLE (fictional, only illustrates syntax)

# Jordan Example

## Basic Info
- Email: jordan@example.com
- Location: Example City, ST
- Website: https://example.com

## Summary
IT professional experienced in network operations, systems troubleshooting, and technical documentation.

## Skills
- Networking: TCP/IP, DNS, VLANs
- Tools: Python, Linux

## Experience
### Network Technician | Example Organization
January 2022 - December 2024 | Example City, ST
Hours per week: 40
- Configured VLANs and documented switch changes for the support team. <!-- tags: network, support -->
- Automated system checks with Python to support troubleshooting. <!-- tags: automation, systems -->

## Projects
### Network Monitor | Personal Project
2024 | https://example.com/project
- Built a dashboard to track service availability and investigate network outages. <!-- tags: network, software -->

## Education
### B.S. in Information Technology | Example University
2018 - 2022
- Completed a capstone focused on Linux service monitoring. <!-- tags: systems -->

## Certifications
### Example Earned Credential | Example Issuer
Earned: 2023

## Certifications in Progress
### Example Planned Credential | Example Issuer
Status: studying; exam not yet scheduled

FINAL SELF-CHECK

Check that every fact comes from my supplied material, every entry uses ###, metadata is unbulleted, achievement tags are supported and consistent, no unsupported section headings appear, and in-progress credentials are not presented as earned.

MY SOURCE MATERIAL:
[I will paste my resume or career notes here, or attach them alongside this prompt.]
