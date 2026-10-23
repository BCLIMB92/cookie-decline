const actionButton = document.querySelector("#action");
const status = document.querySelector("#status");

actionButton.addEventListener("click", () => {
    status.textContent = "Action completed.";
});
