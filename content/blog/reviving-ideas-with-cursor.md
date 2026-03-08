---
title: "Reviving Ideas with Cursor: Custom Cucumber JUnit 5"
date: 2026-01-10
tags:
  - automation
  - ai
  - programming
  - testing
category: engineering
summary: "How AI Helped Me Build Smarter Test Execution and Benchmark a Customized JUnit5 Engine."
---

# How Cursor and Claude Helped Me Finish a Stalled Test Automation Project

I didn’t expect a casual chat with a colleague to reignite an old project I had quietly given up on.

He mentioned using **Cursor** to boost his test automation productivity. I was intrigued.

Sure, I’d used AI before — for fun tasks like naming a baby, answering trivia, or generating images. But using AI for actual engineering? I hadn’t crossed that line.

Until I tried **Cursor** and **Claude**.

---

## The Problem: Why Standard Cucumber + JUnit5 Didn’t Cut It

At **Blibli**, we rely on an internal automation test framework called **Badak**, built on top of **Cucumber-JVM** and **JUnit4**.

In 2024, I initiated an implementation of **JUnit5** for the Badak framework to improve:

- Modularity
- Parallel execution capabilities

That’s where I hit a wall.

The default **JUnit5 + Cucumber-JVM** setup didn’t match our needs:

- ❌ No **step-level notifications**
- ❌ No built-in support to **order scenarios in parallel runs**
- ❌ Weak **rerun capabilities** for flaky tests

To solve this, I started building a prototype module called:

```
badak-junit5
```

The goal was to extend the framework and add the missing capabilities.

However, two major blockers stopped the project:

1. **Custom execution order of scenarios during parallel runs**
2. **Reliable rerun mechanisms without spawning separate JVMs**

Eventually, the project stalled.

---

## Enter Cursor: An AI Sidekick

Months later, I decided to revisit **badak-junit5**, this time using:

- **Cursor**
- **Claude**

That changed everything.

I won’t dive into the deep technical details here. What matters is how Cursor helped me **relearn concepts and solve problems that had previously blocked me for months.**

---

## The Result

Using **Cursor 1.1** with **Claude 4 Sonnet**, I managed to finish `badak-junit5` in:

![badak-junit5 timeline](/content/assets/images/badak-junit5-timeline.png)

**~3 days (about 24 hours of total work time).**

This was a project that had previously **stalled for months**.

Here’s how Cursor made it possible:

- By giving clearer context and requirements in the prompt, Cursor was able to generate a **custom scenario ordering mechanism** that worked as expected.
- Complex mechanisms became easier to implement, resulting in a **robust rerun system** that handles flaky tests elegantly.
- Even **benchmarking and experimentation** became much easier.

---

## Lessons Learned from Pair Programming with AI

This experience taught me a few things:

- **AI thrives on good context**  
  The better your prompt, the better the result.

- **Ask AI to summarize its own solution**  
  This helps spot flaws and understand complex changes.

- **Beware of overengineering**  
  Cursor sometimes proposed overly complex solutions. Simplifying the requirements helped steer it toward better designs.

- **Manual review is still essential**  
  AI helps accelerate development, but it doesn’t replace engineering judgment.

Most importantly, **AI gives you momentum**. When you don’t know where to start or what to ask, it lets you try, fail, and learn rapidly.

---

## Final Thoughts

Using Cursor felt like cheating — **in the best way**.

It handled around **75% of the heavy lifting**, while I focused on reviewing, refining, and integrating the final solution. I learned a lot in the process and finished the project much faster than I expected.

Got a dusty side project or a stubborn bug?

Let AI take a swing. You might just revive an old idea — and make it better than ever.

Here’s to continuous improvement — and beyond.

---

You can check the original article at  
[Medium](https://medium.com/bliblidotcom-techblog/reviving-ideas-with-cursor-custom-cucumber-junit-5-ebd29472d2dd)
