const quotesURL = "https://my-json-server.typicode.com/khlee2016/web2025/comments/1";
console.log(quotesURL);
fetch(quotesURL)
.then(response => response.json())
.then(data => {
const result = document.querySelector("#result");
result.querySelector(".quote").innerHTML = data.body;
result.querySelector(".author").innerHTML = ` - ${data.user}`;
})
.catch(error => console.log(error));
