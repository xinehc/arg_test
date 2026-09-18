export function setSearchBusy(button, busy) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.querySelector(".search-button-label").textContent = busy
    ? "Searching…"
    : "Search";
}
