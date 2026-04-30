    
(function () {
    "use strict";

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

    /* dropzone */
    let myDropzone = new Dropzone(".dropzone");
    myDropzone.on("addedfile", file => {
        console.log(`File added: ${file.name}`);
    });
    
        
    // for personal information browsers
    const multipleCancelButton = new Choices(
        '#browsers',
        {
            allowHTML: true,
            removeItemButton: true,
        }
    );
    
        
    // for personal information browsers
    const multipleCancelButton1 = new Choices(
        '#files',
        {
            allowHTML: true,
            removeItemButton: true,
        }
    );
        
    // for personal information browsers
    const multipleCancelButton2 = new Choices(
        '#tags',
        {
            allowHTML: true,
            removeItemButton: true,
        }
    );

})();