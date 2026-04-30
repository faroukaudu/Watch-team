(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        // ✅ Initialize Choices.js dropdowns
        const choices1 = document.querySelector('#choices-multiple-remove-button1');
        if (choices1) {
            new Choices(choices1, {
                allowHTML: true,
                removeItemButton: true,
            });
        }

        const choices2 = document.querySelector('#choices-multiple-remove-button2');
        if (choices2) {
            new Choices(choices2, {
                allowHTML: true,
                removeItemButton: true,
            });
        }

        // ✅ Initialize Flatpickr DateTime Picker
        const targetDate = document.querySelector('#targetDate');
        if (targetDate) {
            flatpickr(targetDate, {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                disableMobile: true
            });
        }

        // ✅ Initialize FilePond uploader
        const uploadInput = document.querySelector('.multiple-filepond');
        if (uploadInput) {
            FilePond.registerPlugin(
                FilePondPluginImagePreview,
                FilePondPluginImageExifOrientation,
                FilePondPluginFileValidateSize,
                FilePondPluginFileEncode,
                FilePondPluginImageEdit,
                FilePondPluginFileValidateType,
                FilePondPluginImageCrop,
                FilePondPluginImageResize,
                FilePondPluginImageTransform
            );
            FilePond.create(uploadInput);
        }

    });

})();