---
version: beta
name: ONE SET Training System
description: A direct, poster-like training interface with one obvious action and calm progressive disclosure.
colors:
  primary: "#F04B25"
  on-primary: "#FFFFFF"
  ink: "#171917"
  paper: "#FFFAF2"
  paper-muted: "#F3EEE4"
  line: "#D8D1C5"
  success: "#47704E"
typography:
  body-md:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  display-xl:
    fontFamily: "Impact, Arial Narrow, PingFang SC, sans-serif"
    fontSize: 64px
    fontWeight: 900
    lineHeight: 0.92
rounded:
  sm: 10px
  md: 14px
  lg: 22px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: 70px
  surface-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
---

# DESIGN.md

## Overview

ONE SET should feel like a focused training tool and a bold coaching poster, not an AI dashboard. The first viewport answers one question: how do I start today's workout?

## Colors

Warm paper surfaces support long reading sessions. Dense black creates hierarchy. Orange-red marks the primary action and active training state. Green is reserved for completed or recovered status.

## Typography

Display copy is compact and forceful. Body copy never drops below 14px on phones, and training instructions target 16px or larger. Tiny uppercase labels are supporting metadata only and never carry essential meaning.

## Layout

The home flow is ordered: recommendation, voice shortcut, optional customization. Detail appears progressively. All phone controls use at least a 44px touch target, with one-column stacking below 700px.

## Elevation & Depth

Use borders and tonal paper changes before shadows. Avoid glass effects, decorative gradients, and floating card grids.

## Shapes

Primary surfaces use restrained 14–22px radii. Circular shapes are reserved for status, voice, and numbered steps.

## Components

Primary buttons are full-width, high-contrast, and state their outcome. Secondary controls never visually compete with workout generation. Exercise detail prioritizes short video, three coaching steps, and one next action.

## Do's and Don'ts

- Do keep the one-tap recommendation visible without scrolling.
- Do use plain Chinese and English action labels.
- Do preserve visible focus states, reduced motion, and accessible zoom.
- Do not show multiple competing generate buttons in the collapsed home state.
- Do not use emoji as core navigation icons.
- Do not expose advanced profile fields until the user asks for control.
