function getLinkExtension( linkUri ){
    var return_value = null;
    
    if( linkUri != null ) {
        var uri = linkUri.toLowerCase();
        var dotPos = uri.lastIndexOf( "." );
        
        if( dotPos > 0 ){
            return_value = uri.substring( dotPos + 1);
        }
    }
    
    return return_value;
}

function isImageLink( uri ){
    if( uri != null ){
        return (img_exts.indexOf( getLinkExtension( uri ) ) >= 0 ? true : false) || (uri.indexOf( 'imgur' ) > 0);
    }
    
    return false;
}

function getImageLink( uri ){
    if( uri.indexOf( 'imgur' ) > 0 ){
        return uri + ".jpg";
    }else{
        return uri;
    }
}

var lnk_list = document.querySelectorAll('a');
for( var ii in lnk_list ){
    var lnk = lnk_list[ii];
    
    if( isImageLink( lnk.href ) ){
        if( !lnk.classList.contains(CONVERTED_CLASS_NAME) ){
            var img = document.createElement('img');
            img.setAttribute( 'src', getImageLink( lnk.href ) );
            img.setAttribute( 'style', 'display: block;max-width:780px;' );
            
            lnk.appendChild( img );
            
            lnk.classList.add(CONVERTED_CLASS_NAME);
        }
    }
}