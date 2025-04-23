
(function () {
    'use strict'

    // keyboard control
    var swiper = new Swiper(".related-domains", {
        slidesPerView: 1,
        spaceBetween: 30,
        keyboard: {
            enabled: true,
        },
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        loop: true,
        autoplay: {
            delay: 1500,
            disableOnInteraction: false
        }
    });

    /* Start::Choices JS */
    document.addEventListener('DOMContentLoaded', function () {
        var genericExamples = document.querySelectorAll('[data-trigger]');
        for (let i = 0; i < genericExamples.length; ++i) {
            var element = genericExamples[i];
            new Choices(element, {
                allowHTML: true,
                placeholderValue: 'This is a placeholder set in the config',
                searchPlaceholderValue: 'Search Here',
            });
        }
    });

})();

function updateTimer() {
    future = Date.parse("Dec 19, 2024 11:30:00");
    now = new Date();
    diff = future - now;

    days = Math.floor(diff / (1000 * 60 * 60 * 24));
    hours = Math.floor(diff / (1000 * 60 * 60));
    mins = Math.floor(diff / (1000 * 60));
    secs = Math.floor(diff / 1000);

    d = days;
    h = hours - days * 24;
    m = mins - hours * 60;
    s = secs - mins * 60;

    document.getElementById("timer")
        .innerHTML =
        '<div class="card custom-card text-default align-items-center justify-content-between mb-0"><div class="flex-fill text-center card-body p-4"><p class="mb-1 lh-1 fs-11 text-muted fw-medium">DAYS</p><h4 class="mb-0 lh-1 mt-2 d-block text-default">' + d + '</h4></div></div>' +
        '<div class="card custom-card text-default align-items-center justify-content-between mb-0"><div class="flex-fill text-center card-body p-4"><p class="mb-1 lh-1 fs-11 text-muted fw-medium">HOURS</p><h4 class="mb-0 lh-1 mt-2 d-block text-default">' + h + '</h4></div></div>' +
        '<div class="card custom-card text-default align-items-center justify-content-between mb-0"><div class="flex-fill text-center card-body p-4"><p class="mb-1 lh-1 fs-11 text-muted fw-medium">MINUTES</p><h4 class="mb-0 lh-1 mt-2 d-block text-default">' + m + '</h4></div></div>' +
        '<div class="card custom-card text-default align-items-center justify-content-between mb-0"><div class="flex-fill text-center card-body p-4"><p class="mb-1 lh-1 fs-11 text-muted fw-medium">SECONDS</p><h4 class="mb-0 lh-1 mt-2 d-block text-default">' + s + '</h4></div></div>'
}
setInterval('updateTimer()', 1000);