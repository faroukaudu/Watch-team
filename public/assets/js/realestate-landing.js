(function () {
    "use strict";

    // for testimonials
    var swiper3 = new Swiper(".pagination-dynamic", {
        pagination: {
            el: ".swiper-pagination",
            dynamicBullets: true,
            clickable: true,
        },
        slidesPerView: 1,
        loop: true,
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        breakpoints: {
            768: {
                slidesPerView: 1,
                spaceBetween: 40,
            },
            1024: {
                slidesPerView: 1,
                spaceBetween: 50,
            },
            1400: {
                slidesPerView: 1,
                spaceBetween: 50,
            },
        },
    });

})();
