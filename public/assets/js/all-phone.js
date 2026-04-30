
  document.addEventListener("DOMContentLoaded", function() {
      // Select all elements with class 'phone-input' and initialize intlTelInput
      document.querySelectorAll('.phone-input').forEach(function(input) {
          intlTelInput(input, {
              initialCountry: "auto",
              geoIpLookup: function(callback) {
                  fetch("https://ipinfo.io/json?token=YOUR_TOKEN") // Use your IP lookup service
                      .then(response => response.json())
                      .then(data => callback(data.country))
                      .catch(() => callback("us"));
              },
              utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
          });
      });
  });
