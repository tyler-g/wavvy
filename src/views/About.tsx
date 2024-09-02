import { useEffect } from 'react';

const About = () => {
  console.log('About view render');
  useEffect(() => {
    console.log('about');
    window.scrollTo({
      top: 5000,
      left: 0,
      behavior: 'smooth',
    });
  }, []);

  return (
    <div className="sm container mx-auto">
      <h1>About</h1>
      <p>
        waVVy started as a personal project when it became clear that WebAudio
        was becoming better supported and more powerful in the browser
      </p>
      <p>The original prototype was written in Vue2 without Typescript</p>
      <p>This is a rewrite in Typescript and latest stable technologies</p>
      <p>Stack: ReactJS + TypeScript + Vite + PeerJS + ReactQuery</p>
    </div>
  );
};

export default About;
