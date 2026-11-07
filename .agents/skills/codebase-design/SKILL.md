---
name: codebase-design
description: Vocabulary and discipline for designing deep modules: a lot of behaviour behind a small interface at a clean seam. Use when deciding a module's shape, interface, or boundaries, or when tests are hard to write.
---

# Codebase Design

## Vocabulary

- **Module:** any unit with an interface: function, class, package, service.
- **Interface:** everything a caller must know to use it, including errors and ordering rules.
- **Depth:** behaviour provided divided by interface size. Deep is good: small interface, a lot behind it.
- **Shallow module:** interface almost as complex as the implementation. A smell.
- **Seam:** a boundary where you can observe or swap behaviour without editing callers. Tests go here.
- **Adapter:** code that translates between your interface and an outside system, kept at the edge.
- **Leverage:** how much other code gets simpler when this module exists.
- **Locality:** things that change together live together.

## Rules

- Prefer a few deep modules over many shallow ones.
- Hide decisions likely to change behind the interface.
- Put side effects (network, disk, clock) behind adapters at the edge.
- Pull complexity down: the module should handle the hard part so callers do not.
- **Design it twice:** sketch two very different interfaces before picking one; write why in the ticket or an ADR.
