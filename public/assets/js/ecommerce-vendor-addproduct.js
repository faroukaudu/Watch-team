    
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
    
        
    // for personal information browsers
    const multipleCancelButton = new Choices(
        '#payment',
        {
            allowHTML: true,
            removeItemButton: true,
        }
    );

    //for tags
    var textPresetVal = new Choices('#tags-name', {
        allowHTML: true,
        items: [
            {
                customProperties: {
                    description: 'Numbers are infinite',
                },
            },
        ],
    });

})();