---
layout: default
permalink: /blog/
title: blog
nav: true
nav_order: 1
pagination:
  enabled: false
  collection: posts
  permalink: /page/:num/
  per_page: 5
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3 # The number of links after the current page
---
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
.bl2 { width: min(1040px, calc(100vw - 48px)); position: relative; left: 50%; transform: translateX(-50%); margin: 0 0 96px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0d0d0f; -webkit-font-smoothing: antialiased; }
.bl2 h1 { font-size: 34px; font-weight: 700; letter-spacing: -.035em; line-height: 1.15; color: #0d0d0f; margin: 4px 0 8px; }
.bl2 .lead { font-size: 17px; line-height: 1.55; color: #2b2c30; margin: 0 0 22px; }
.bl2 a.item { display: grid; grid-template-columns: minmax(0, 440px) minmax(0, 1fr); gap: 44px; align-items: center; padding: 30px 0; border-top: 1px solid #e5e6e9; color: #0d0d0f; text-decoration: none; }
.bl2 a.item:hover { color: #0d0d0f; }
.bl2 .pv { position: relative; aspect-ratio: 16 / 9; border-radius: 16px; overflow: hidden; background: #f5f5f6; box-shadow: 0 0 0 1px rgba(13,13,15,.08); }
.bl2 .pv img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s cubic-bezier(.2,.7,.2,1); }
.bl2 a.item:hover .pv img { transform: scale(1.035); }
.bl2 .tt { font-size: 25px; font-weight: 650; letter-spacing: -.025em; line-height: 1.22; margin: 0 0 10px; color: #0d0d0f; }
.bl2 a.item:hover .tt { text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 4px; }
.bl2 .ds { font-size: 16px; line-height: 1.55; color: #2b2c30; margin: 0 0 14px; }
.bl2 .mt { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 14px; font-weight: 500; color: #0d0d0f; }
.bl2 .mt .src { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: #f5f5f6; }
.bl2 .mt svg { width: 13px; height: 13px; }
@media (max-width: 860px) {
  .bl2 { width: calc(100vw - 32px); }
  .bl2 a.item { grid-template-columns: 1fr; gap: 16px; padding: 26px 0; }
  .bl2 .tt { font-size: 22px; }
}
</style>
<div class="bl2">
<h1>Blog</h1>
{% for post in site.posts %}
{% if post.redirect contains '://' %}{% assign href = post.redirect %}{% assign ext = true %}{% elsif post.redirect %}{% assign href = post.redirect | relative_url %}{% assign ext = false %}{% else %}{% assign href = post.url | relative_url %}{% assign ext = false %}{% endif %}
<a class="item" href="{{ href }}"{% if ext %} target="_blank" rel="noopener"{% endif %}>
<div class="pv">{% if post.thumbnail %}<img src="{{ post.thumbnail | relative_url }}" alt="" loading="lazy">{% endif %}</div>
<div>
<div class="tt">{{ post.title }}</div>
<p class="ds">{{ post.description }}</p>
<div class="mt"><span>{{ post.date | date: '%B %-d, %Y' }}</span>{% if post.external_source %}<span class="src">{{ post.external_source }}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>{% endif %}</div>
</div>
</a>
{% endfor %}
</div>
