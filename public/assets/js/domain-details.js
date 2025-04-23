(function () {
    "use strict";

    var lightboxVideo = GLightbox({
        selector: '.glightbox'
    });
    lightboxVideo.on('slide_changed', ({ prev, current }) => {
        console.log('Prev slide', prev);
        console.log('Current slide', current);

        const { slideIndex, slideNode, slideConfig, player } = current;
    });

    // swiper with navigation
    var swiper = new Swiper(".swiper-related-jobs", {
        slidesPerView: 1,
        spaceBetween: 30,
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        loop: true,
        autoplay: {
            delay: 1500,
            disableOnInteraction: false,
        },
        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 0,
            },
            640: {
                slidesPerView: 1,
                spaceBetween: 0,
            },
            768: {
                slidesPerView: 1,
                spaceBetween: 5,
            },
            1024: {
                slidesPerView: 1,
                spaceBetween: 20,
            }
        },
    });
    
})();

// Market Statistics
var options = {
	series: [{
		name: "Profit",
		data: [20, 38, 38, 72, 55, 63, 43, 76, 55, 80, 40, 80]
	}, {
		name: "Total Views",
		data: [85, 65, 75, 38, 85, 35, 62, 40, 40, 64, 50, 89]
	}],
	chart: {
		height: 300,
		type: 'line',
		zoom: {
			enabled: false
		},
		dropShadow: {
			enabled: true,
			enabledOnSeries: undefined,
			top: 5,
			left: 0,
			blur: 3,
			color: '#000',
			opacity: 0.1
		},
	},
	dataLabels: {
		enabled: false
	},
	legend: {
		position: "top",
		horizontalAlign: "center",
		offsetX: -15,
		fontWeight: "bold",
	},
	stroke: {
		curve: 'smooth',
		width: '2',
		dashArray: [0, 5],
	},
	grid: {
		borderColor: '#f2f6f7',
	},
	colors: ["var(--primary-color)", "var(--primary03)"],
	yaxis: {
		title: {
			text: 'Statistics',
			style: {
				color: '#adb5be',
				fontSize: '14px',
				fontFamily: 'poppins, sans-serif',
				fontWeight: 600,
				cssClass: 'apexcharts-yaxis-label',
			},
		},
	},
	xaxis: {
		type: 'month',
		categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		axisBorder: {
			show: true,
			color: 'rgba(119, 119, 142, 0.05)',
			offsetX: 0,
			offsetY: 0,
		},
		axisTicks: {
			show: true,
			borderType: 'solid',
			color: 'rgba(119, 119, 142, 0.05)',
			width: 6,
			offsetX: 0,
			offsetY: 0
		},
		labels: {
			rotate: -90
		}
	}
};
var chart = new ApexCharts(document.querySelector("#market-analytics"), options);
chart.render();