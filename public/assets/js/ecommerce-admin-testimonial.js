(function () {
    'use strict';

    /* On hover event */
    var starRating5 = raterJs({
        starSize: 20,
        reverse: true, //this enable rtl
        element: document.querySelector("#stars-hover"),
        rateCallback: function rateCallback(rating, done) {
            this.setRating(rating);
            done();
        },
        onHover: function (currentIndex, currentRating) {
            document.querySelector('.live-rating').textContent = currentIndex;
        },
        onLeave: function (currentIndex, currentRating) {
            document.querySelector('.live-rating').textContent = currentRating;
        }
    });
    /* On hover event */

    /* dropzone */
    let myDropzone = new Dropzone(".dropzone");
    myDropzone.on("addedfile", file => {
        console.log(`File added: ${file.name}`);
    }); 

})();