// (function () {
    "use strict";


    var swiper1 = new Swiper('.website-swiper', {
        slidesPerView: 4,
        spaceBetween: 0,
        mousewheel: true,
        loop: true,
        direction: "vertical",
        autoplay: {
            delay: 1500,
            disableOnInteraction: false
        }
    });
    var swiper = new Swiper('.domain-swiper', {
        slidesPerView: 4,
        spaceBetween: 0,
        mousewheel: true,
        loop: true,
        direction: "vertical",
        autoplay: {
            delay: 2000,
            disableOnInteraction: false
        }
    });

    var swiper2 = new Swiper('.auction-swiper', {
        slidesPerView: 4,
        spaceBetween: 0,
        mousewheel: true,
        loop: true,
        direction: "vertical",
        autoplay: {
            delay: 2500,
            disableOnInteraction: false
        }
    });

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

// })();