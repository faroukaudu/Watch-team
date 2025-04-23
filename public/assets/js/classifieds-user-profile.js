(function() {
    "use strict"

    /* dropzone */
    let myDropzone = new Dropzone(".dropzone");
    myDropzone.on("addedfile", file => {
        console.log(`File added: ${file.name}`);
    }); 
     
})();