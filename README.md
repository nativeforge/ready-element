<img src="./ready-element-logo.jpg" alt="readyElement logo" style="max-width: 360px">

# readyElement

A zero-dependency base class for Web Components that exposes a deterministic `ready` **Promise**, signaling when a component is ***truly functional***, not just registered.

Pair it with `waitForElementsReady` to coordinate an entire page and eliminate flash-of-unready-content with a single CSS rule.

---

## Why readyElement ?

`customElements.whenDefined('my-element')` only tells you the **class is registered**. It says nothing about whether an instance has fetched its data, rendered its Shadow DOM, or finished any async initialization. The result is silent race conditions: code runs against elements that exist in the DOM but are not yet usable.

`readyElement` closes that gap by introducing a **readiness contract**:

- **Explicit signal.** Call `this._resolveReady()` exactly once, when your component is functional. Nothing guesses; nothing polls.
- **Promise-based.** `await element.ready` is composable with `Promise.all`, `Promise.race`, and `async/await` chains.
- **`ready` attribute.** Once resolved, the element receives a `[ready]` attribute — a CSS hook for transitions and visibility reveals, with no JavaScript glue.
- **`ready` event.** A `ready` event (`bubbles: true, composed: true`) is dispatched at the same moment — for imperative listeners.
- **Idempotent.** `_resolveReady()` is safe to call multiple times; it only resolves once.
- **Zero dependencies.** Extends `HTMLElement` with three private fields and one method. No framework coupling, no build step.

---

## Installation

### Package managers

```bash
npm install @nativelayer.dev/ready-element
```

```bash
pnpm add @nativelayer.dev/ready-element
```

```bash
yarn add @nativelayer.dev/ready-element
```

Then import the base class:

```js
import { readyElement } from '@nativelayer.dev/ready-element'
```

### CDN

No install. Paste directly into HTML:

```html
<script type="module">
  import { readyElement } from 'https://cdn.jsdelivr.net/npm/@nativelayer.dev/ready-element/index.js'
  // extend and register your components here
</script>
```

---

## Usage

### Extending readyElement

Replace `HTMLElement` with `readyElement` in your class definition. Call `this._resolveReady()` at the exact moment your component is functional.

```js
import { readyElement } from '@nativelayer.dev/ready-element'

class MyCard extends readyElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `<p>Hello</p>`
    this._resolveReady()
  }
}

customElements.define('my-card', MyCard)
```

Consumers can then await the element with confidence:

```js
const card = document.querySelector('my-card')
await card.ready
card.doSomething() // guaranteed functional
```

### Async initialization

For components that fetch data or load resources, declare `connectedCallback` as `async` and call `_resolveReady()` after all async work is complete.

```js
class UserProfile extends readyElement {
  async connectedCallback() {
    this.attachShadow({ mode: 'open' })
    const data = await fetch('/api/user').then(r => r.json())
    this.shadowRoot.innerHTML = `<p>${data.name}</p>`
    this._resolveReady()
  }
}

customElements.define('user-profile', UserProfile)
```

**Always wrap async work in `try/catch`.** If an error is thrown before `_resolveReady()` is called, the `ready` Promise will never resolve — leaving any `await element.ready` suspended forever.

```js
class UserProfile extends readyElement {
  async connectedCallback() {
    this.attachShadow({ mode: 'open' })
    try {
      const data = await fetch('/api/user').then(r => r.json())
      this.shadowRoot.innerHTML = `<p>${data.name}</p>`
      this._resolveReady()
    } catch (err) {
      // render a fallback, then still signal readiness
      this.shadowRoot.innerHTML = `<p class="error">Failed to load.</p>`
      this.setAttribute('error', '')
      this._resolveReady()
    }
  }
}
```

Callers that need to distinguish success from failure can check `element.hasAttribute('error')` after awaiting `ready`.

### Disconnect during async initialization

If a component is removed from the DOM while async work is in flight, `_resolveReady()` may never be called. Use an `AbortController` to cancel the in-flight work and still resolve readiness cleanly.

```js
class LiveFeed extends readyElement {
  #abort = new AbortController()

  async connectedCallback() {
    this.attachShadow({ mode: 'open' })
    try {
      const data = await fetch('/api/feed', {
        signal: this.#abort.signal
      }).then(r => r.json())

      this.shadowRoot.innerHTML = this.#render(data)
      this._resolveReady()
    } catch (err) {
      if (err.name === 'AbortError') return // disconnected mid-flight; skip resolve
      this.shadowRoot.innerHTML = `<p class="error">Could not load feed.</p>`
      this._resolveReady()
    }
  }

  disconnectedCallback() {
    this.#abort.abort()
  }

  #render(data) { /* ... */ }
}
```

Aborting mid-flight is intentional — `ready` is left pending. The element is about to leave the DOM, so no consumer should be awaiting it anymore. If the element is re-connected, a fresh `connectedCallback` runs on the same instance, but the `#abort` controller must be replaced since the original signal is already aborted.

```js
async connectedCallback() {
  this.#abort = new AbortController() // fresh controller on every connection
  // ...
}
```

### Reconnection after disconnect

`_resolveReady()` resolves the Promise only **once**. If an element is disconnected and then re-inserted into the DOM, `connectedCallback` fires again — but the `ready` Promise is already resolved and `isReady` is already `true`.

This is usually correct: a previously-ready element reconnecting is still ready. If your component must re-initialize on reconnection (e.g., restart a WebSocket), drive that logic independently of `_resolveReady()`.

```js
class StreamingWidget extends readyElement {
  #socket = null

  connectedCallback() {
    this.#socket = new WebSocket('/ws/feed')
    this.#socket.onopen = () => this._resolveReady() // idempotent on re-connect
  }

  disconnectedCallback() {
    this.#socket?.close()
  }
}
```

### CSS-driven reveal with `[ready]`

Once `_resolveReady()` is called, the element receives the `[ready]` attribute. Use it as a CSS hook to animate or reveal the component without any extra JavaScript.

```css
my-card {
  opacity: 0;
  transition: opacity 0.3s ease;
}

my-card[ready] {
  opacity: 1;
}
```

No class toggling, no `setTimeout`. The attribute appears on the animation frame following `_resolveReady()`.

---

## Core API

### Instance members

| Member | Type | Description |
|--------|------|-------------|
| `ready` | `Promise<void>` | Resolves once `_resolveReady()` has been called. Safe to await multiple times. |
| `isReady` | `boolean` | `true` after `_resolveReady()` has been called. Synchronous check. |
| `_resolveReady()` | `() => void` | Signals that the element is functional. Idempotent — safe to call more than once, resolves exactly once. |

### `[ready]` attribute

Set automatically on the host element (via `setAttribute('ready', '')`) on the animation frame following `_resolveReady()`. Never set it manually.

### `ready` event

Dispatched on the element at the same moment as the attribute (`bubbles: true, composed: true`). Use for one-off imperative listeners:

```js
element.addEventListener('ready', () => {
  console.log('element is functional')
}, { once: true })
```

---

## Examples

### Waiting for a single element

```js
const header = document.querySelector('site-header')
await header.ready
// header is rendered and functional
```

### Null-safe access before awaiting

`document.querySelector` returns `null` when the element is absent. Guard before you await.

```js
const header = document.querySelector('site-header')
if (!header) throw new Error('<site-header> not found in the DOM')
await header.ready
header.setUser(currentUser)
```

### Already-ready element

If `isReady` is already `true`, `await element.ready` still resolves — immediately on the next microtask, never synchronously. This is safe to call unconditionally.

```js
async function refresh(el) {
  await el.ready // resolves immediately if already ready
  el.refresh()
}
```

### Waiting for multiple elements

```js
const [nav, feed, footer] = ['site-nav', 'news-feed', 'site-footer']
  .map(tag => document.querySelector(tag))

await Promise.all([nav.ready, feed.ready, footer.ready])
// all three are ready
```

### Timeout with `Promise.race`

`ready` never rejects on its own. Wrap it in `Promise.race` to add a deadline.

```js
function withTimeout(promise, ms, label = 'element') {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timeout])
}

const chart = document.querySelector('data-chart')
await withTimeout(chart.ready, 3000, 'data-chart')
chart.setData(payload)
```

### Dynamic element creation

`createElement` does not trigger `connectedCallback`. Append the element to the DOM first, then await `ready`.

```js
const panel = document.createElement('dashboard-panel')
document.body.appendChild(panel) // connectedCallback fires here
await panel.ready              // now safe to interact
panel.openTab('overview')
```

### Reacting to readiness via event

```js
const widget = document.querySelector('data-widget')

widget.addEventListener('ready', () => {
  widget.loadPage(1)
}, { once: true })
```

### Synchronous check

```js
if (card.isReady) {
  card.refresh()
} else {
  await card.ready
  card.refresh()
}
```

Or more concisely:

```js
await card.ready // free if already resolved
card.refresh()
```

### CSS transition on reveal

```css
user-profile {
  visibility: hidden;
  transform: translateY(8px);
  transition: visibility 0s 0.2s, opacity 0.2s ease, transform 0.2s ease;
  opacity: 0;
}

user-profile[ready] {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0s;
}
```

No JavaScript needed for the reveal. The `[ready]` attribute drives everything.

### Coordinating a parent with its children

```js
class DashboardPanel extends readyElement {
  async connectedCallback() {
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <data-chart></data-chart>
      <data-table></data-table>
    `
    const chart = this.shadowRoot.querySelector('data-chart')
    const table = this.shadowRoot.querySelector('data-table')
    await Promise.all([chart.ready, table.ready])
    this._resolveReady()
  }
}
```

The panel stays "not ready" until every child is ready. The parent orchestrates; the children signal.

### Conditional readiness

An element can signal readiness without fetching data — for example, when it only needs to parse its own attributes.

```js
class ColorSwatch extends readyElement {
  connectedCallback() {
    const color = this.getAttribute('color') ?? '#ccc'
    this.style.setProperty('--swatch', color)
    this._resolveReady()
  }
}
```

### Signaling readiness from an internal event

When wrapping a third-party library that emits its own lifecycle events, bridge those events to `_resolveReady()`.

```js
class LeafletMap extends readyElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' })
    const container = document.createElement('div')
    this.shadowRoot.appendChild(container)
    const map = L.map(container).setView([51.5, -0.09], 13)
    map.once('load', () => this._resolveReady())
  }
}
```

---

## Anti-patterns

### ❌ Accessing a child before it is ready

```js
connectedCallback() {
  this.innerHTML = `<data-table></data-table>`
  const table = this.querySelector('data-table')
  table.load() // race condition — table may not be defined yet
}
```

### ✅ Await the child's ready Promise

```js
async connectedCallback() {
  this.innerHTML = `<data-table></data-table>`
  const table = this.querySelector('data-table')
  await table.ready
  table.load()
}
```

---

### ❌ Resolving in the constructor

```js
constructor() {
  super()
  this._resolveReady() // too early — element is not even connected
}
```

The constructor runs before the element is attached to the DOM. Always resolve inside `connectedCallback`, after real work is done.

### ✅ Resolve after actual initialization

```js
async connectedCallback() {
  this.attachShadow({ mode: 'open' })
  await this.fetchData()
  this.render()
  this._resolveReady()
}
```

---

### ❌ Silently swallowing errors without resolving

```js
async connectedCallback() {
  try {
    const data = await fetch('/api/data').then(r => r.json())
    this.render(data)
    this._resolveReady()
  } catch (err) {
    console.error(err)
    // _resolveReady() never called — any await on element.ready hangs forever
  }
}
```

### ✅ Always call `_resolveReady()` in every code path

```js
async connectedCallback() {
  try {
    const data = await fetch('/api/data').then(r => r.json())
    this.render(data)
  } catch (err) {
    this.renderError(err)
    this.setAttribute('error', '')
  } finally {
    this._resolveReady()
  }
}
```

---

### ❌ Awaiting `ready` on a `null` reference

```js
const el = document.querySelector('data-chart') // may be null
await el.ready // TypeError: Cannot read properties of null
```

### ✅ Guard before awaiting

```js
const el = document.querySelector('data-chart')
if (!el) throw new Error('<data-chart> not found')
await el.ready
```

---

### ❌ Using `.then()` in an async connectedCallback

```js
connectedCallback() {
  fetch('/data')
    .then(r => r.json())
    .then(data => {
      this.render(data)
      this._resolveReady()
    })
  // returns undefined — waitForElementsReady sees no Promise
}
```

If you use `waitForElementsReady`, it needs `connectedCallback` to return a Promise. `.then()` chains without a `return` are fire-and-forget.

### ✅ Use async/await and return the Promise

```js
async connectedCallback() {
  const data = await fetch('/data').then(r => r.json())
  this.render(data)
  this._resolveReady()
}
```

---

### ❌ Creating an element without appending it

```js
const el = document.createElement('my-card')
await el.ready // hangs — connectedCallback never fires
```

`connectedCallback` is only called when the element enters the DOM.

### ✅ Append first, then await

```js
const el = document.createElement('my-card')
document.body.appendChild(el)
await el.ready
```

---

## Edge cases

### One-frame delay between `_resolveReady()` and Promise resolution

`_resolveReady()` defers its work to `requestAnimationFrame`. This means there is a ~16 ms gap between calling `_resolveReady()` and the `ready` Promise actually resolving. Code that must run before the next paint is fine — but do not rely on the `[ready]` attribute or the `ready` event being available synchronously after calling `_resolveReady()`.

```js
this._resolveReady()
console.log(this.isReady) // true  — the flag is set immediately
console.log(this.hasAttribute('ready')) // false — attribute set on next rAF
await this.ready
console.log(this.hasAttribute('ready')) // true
```

### Element defined after it is already in the DOM (upgrade)

When `customElements.define` is called after elements are already parsed into the DOM, the browser *upgrades* each existing instance by calling its constructor and `connectedCallback`. The contract works identically — the upgrade is transparent to `readyElement`.

```html
<my-card></my-card> <!-- already in DOM -->

<script type="module">
  // define arrives after parsing
  customElements.define('my-card', MyCard)
  const card = document.querySelector('my-card')
  await card.ready // works — connectedCallback was called during upgrade
</script>
```

### SSR / environments without `requestAnimationFrame`

`readyElement` uses `requestAnimationFrame` internally. In server-side rendering or test environments that do not provide it, polyfill it before importing `readyElement`:

```js
// at the top of your entry point or test setup
if (typeof requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0)
}
```

### `ready` never rejects

The `ready` Promise can only resolve — it never rejects. If your initialization fails and you do not call `_resolveReady()`, the Promise remains pending indefinitely. Always resolve (or call `_resolveReady()` via `finally`) in every code path, and use `Promise.race` with a timeout if you need failure detection from the outside.

---

## Companion utilities

`readyElement` is the foundational building block. Two companion utilities extend it for larger orchestration needs.

### `makeReady` — retrofit any class

When you can't modify a component's base class (third-party elements, generated code), use `makeReady` to inject the same contract via prototype injection.

```js
import { makeReady } from '@nativelayer.dev/make-ready'
import ThirdPartyCarousel from '/vendor/carousel.js'

makeReady(ThirdPartyCarousel)
ThirdPartyCarousel.readyEvent = 'carousel-ready'
customElements.define('third-party-carousel', ThirdPartyCarousel)

const carousel = document.querySelector('third-party-carousel')
await carousel.ready // resolves when 'carousel-ready' fires
```

`makeReady` supports five resolution strategies (async `connectedCallback`, custom event, attribute sentinel, and more). See `makeReady.md` for details.

### `waitForElementsReady` — page-level orchestration

Discovers every custom element inside a target, waits for all of them to resolve their `ready` Promise, then adds a CSS class to reveal the page — all in one call.

```js
import { waitForElementsReady } from '@nativelayer.dev/wait-for-elements-ready'

await waitForElementsReady(document.body)
```

```css
body       { visibility: hidden; }
body.ready { visibility: visible; }
```

When the `await` returns, every `readyElement` on the page has called `_resolveReady()`. The `.ready` class is added atomically. No FOUC, no JavaScript-driven class toggling in multiple places.

---

## Relationship with `customElements.whenDefined`

These two APIs answer different questions:

| API | Answers |
|-----|---------|
| `customElements.whenDefined('tag')` | Is the class registered? |
| `element.ready` | Is this instance functional? |

Use them together when working with dynamically imported components:

```js
await customElements.whenDefined('data-chart')
const chart = document.querySelector('data-chart')
await chart.ready
chart.setData(payload)
```

`whenDefined` ensures the class exists. `ready` ensures the instance is usable.

For dynamically created elements, combine all three steps:

```js
// import triggers registration
await import('/components/data-chart.js')
const chart = document.createElement('data-chart')
document.body.appendChild(chart)
await chart.ready
chart.setData(payload)
```

---

## License

MIT.

See [LICENSE](./LICENSE) for the full text.
