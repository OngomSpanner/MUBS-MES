import Script from 'next/script';

const TAWK_PROPERTY_ID = '6a1c82754f01be1c30d8202b';
const TAWK_WIDGET_ID = '1jpvlr7m7';

/** Tawk.to live chat — compact launcher + panel via CSS scale (see globals.css). */
export default function TawkToWidget() {
  return (
    <Script
      id="tawk-to"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
          Tawk_API.customStyle={
            zIndex:9999,
            visibility:{
              desktop:{position:'br',xOffset:12,yOffset:16},
              mobile:{position:'br',xOffset:8,yOffset:12},
              bubble:{rotate:'0deg',xOffset:0,yOffset:0}
            }
          };
          (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
          })();
        `,
      }}
    />
  );
}
