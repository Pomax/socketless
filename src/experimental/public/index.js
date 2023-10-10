import { Socketless } from "./socketless.js";

console.log("script running", Socketless);

const client = (window.client = Socketless.createWebClient());
const result = await client.test(1,2,3);
console.log(`result=${result}`);
