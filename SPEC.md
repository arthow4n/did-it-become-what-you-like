# Application Specification

## Status

This document is the starting point for the application specification. Product
requirements, user experience, and implementation details will be added only
after they have been discussed and agreed upon.

## Agreed Constraints

- The application must be a Progressive Web App (PWA).
- The frontend must be deployable as a static site on GitHub Pages.
- The project must use Deno 2 to execute all development and build tooling,
  including the frontend toolchain.
- A backend should be avoided unless an agreed product requirement cannot be
  met reasonably in the client.
- If a backend becomes necessary, it must be designed for and deployed on Deno
  Deploy.

## Architecture Principle

Prefer a local-first, static architecture. Any proposal to introduce a backend
must identify the requirement it serves, explain why a browser-only solution is
insufficient, and be agreed upon before implementation.

## To Be Specified

- Product purpose and target users
- Core user journeys and features
- Data model, persistence, and synchronization
- Offline behavior and installation experience
- Accessibility and browser support
- Visual and interaction design
- Testing and acceptance criteria
- Deployment and release workflow
