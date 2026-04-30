var swiper = new Swiper(".pagination-dynamic", {
    pagination: {
        el: ".swiper-pagination",
        dynamicBullets: true,
        clickable: true,
    },
    loop: true,
    autoplay: {
        delay: 1500,
        disableOnInteraction: false
    }
});