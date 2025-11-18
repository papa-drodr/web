
let quotesURL = "http://dummyjson.com/quotes/";
const random = Math.floor(Math.random() * 1455);  // 0 ~ 1454 사이의 수
quotesURL = "https://dummyjson.com/quotes/" + random;
console.log(quotesURL);
fetch(quotesURL)
  .then(response => response.json())
  .then(data => {
    const result = document.querySelector("#result");
    result.querySelector(".quote").innerHTML = data.quote;
    result.querySelector(".author").innerHTML = ` - ${data.author}`;
  })
  .catch(error => console.log(error));
  
