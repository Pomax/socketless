/**
 * This is a demonstration client.
 */
export default class WebClientClass {
  // update the page in a silly way:
  update() {
    document.querySelector("#clientid").textContent = this.id;

    const el = document.createElement("ul");
    this.users.forEach(u => {
      let li = document.createElement("li");
      li.textContent = u;
      el.appendChild(li);
    });
    let ul = document.querySelector("#list ul");

    ul.parentNode.replaceChild(el, ul);
  }

  // update the page in an equally silly way:
  async "chat:message"({ id, message }) {
    document.querySelector("#chat").innerHTML += `
      <div><span>${id}: ${message}</span></div>
    `;
  }
}
