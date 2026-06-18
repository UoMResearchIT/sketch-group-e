export function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var k="rplace-theme";var t=localStorage.getItem(k);var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`,
      }}
    />
  );
}
