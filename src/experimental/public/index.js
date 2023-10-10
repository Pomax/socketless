import { Socketless } from "./socketless.js";

console.log("script running", Socketless);

const client = (window.client = Socketless.createWebClient());

client.test();
