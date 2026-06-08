/**
 * Base class for custom elements that expose a `ready` Promise.
 *
 * Subclasses call `this._resolveReady()` once their async initialization
 * is complete. The `ready` Promise resolves at that point, and a `ready`
 * event is dispatched (bubbles, composed).
 *
 * @example
 * class MyElement extends readyElement {
 *   async connectedCallback() {
 *     await this.loadData()
 *     this._resolveReady()
 *   }
 * }
 * customElements.define('my-element', MyElement)
 */
export class readyElement extends HTMLElement {
  #readyResolved = false
  #resolveReady
  #ready = new Promise(resolve => { this.#resolveReady = resolve })

  /**
   * A Promise that resolves once `_resolveReady()` has been called.
   * Awaiting this guarantees the element has finished its initialization.
   *
   * @type {Promise<void>}
   */
  get ready() { return this.#ready }

  /**
   * Whether this element has already resolved its ready signal.
   *
   * @type {boolean}
   */
  get isReady() { return this.#readyResolved }

  /**
   * Signal that this element is ready.
   * Idempotent — safe to call multiple times, only resolves once.
   * Dispatches a `ready` event (`bubbles: true, composed: true`).
   *
   * @returns {void}
   */
  _resolveReady() {
    if (this.#readyResolved) return
    this.#readyResolved = true
    requestAnimationFrame(() => {
      this.setAttribute('ready', '')
      this.dispatchEvent(new Event('ready', { bubbles: true, composed: true }))
      this.#resolveReady()
    })
  }
}
