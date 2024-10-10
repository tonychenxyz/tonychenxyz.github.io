---
layout: page
title: Services
permalink: /services/
description: Services at Columbia University.
nav: false
services:
  - title: Reviewing
    description: |
      - NeurIPS 2024
      - ICLR 2025
      - AISTATS 2025
  - title: Teaching
    description: |
      - Teaching Assistant: B9153 Generative AI: Technical and Social (PhD Elective)
      - Teaching Assistant: COMS 3261 Computer Science Theory
---

<h2>Debug Information</h2>
<p>Number of services: {{ page.services | size }}</p>

{% if page.services %}
  <p>Services are defined</p>
{% else %}
  <p>Services are not defined</p>
{% endif %}

<h2>Services</h2>
{% include services.liquid %}

<h2>Raw Services Data</h2>
<pre>
{{ page.services | jsonify }}
</pre>