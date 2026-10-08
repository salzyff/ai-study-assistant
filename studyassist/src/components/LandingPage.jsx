import ChatIcon from "./ChatIcon";
function LandingPage({ onOpenLogin }) {
  function handleLogin(event) {
    event.preventDefault();
    onOpenLogin();
  }

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="/" aria-label="Study AI home">
          <span aria-hidden="true"><ChatIcon name="sparkle" /></span>
          <strong>Study AI</strong>
        </a>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#schools">For schools</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="landing-login" href="/login" onClick={handleLogin}>Sign in</a>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">A LITTLE HELP WITH YOUR STUDIES</p>
          <h1 id="landing-title">Stuck on a topic? Let’s work through it.</h1>
          <p className="landing-lead">Ask a question, practise a few problems, or get your notes in order. A bit of help can make your next study session easier.</p>
          <div className="landing-actions">
            <a className="landing-primary" href="/login" onClick={handleLogin}>Start learning <span aria-hidden="true">→</span></a>
            <a className="landing-secondary" href="#features">Explore features</a>
          </div>
          <p className="landing-note">For the small questions and the tricky topics.</p>
        </div>
        <div className="landing-visual" aria-hidden="true">
          <div className="landing-orbit landing-orbit-one" />
          <div className="landing-orbit landing-orbit-two" />
          <div className="landing-brain"><ChatIcon name="sparkle" size={60} /></div>
          <div className="landing-card landing-card-top"><span><ChatIcon name="book" /></span><div><strong>Explain a topic</strong><small>Step-by-step support</small></div></div>
          <div className="landing-card landing-card-bottom"><span>✓</span><div><strong>Keep on track</strong><small>Plans, tasks and progress</small></div></div>
        </div>
      </section>

      <section className="landing-section" id="features" aria-labelledby="feature-title">
        <div className="landing-section-intro">
          <p className="landing-kicker">WHAT STUDY AI DOES</p>
          <h2 id="feature-title">Your notes, practice and plans in one place.</h2>
          <p>Instead of jumping between notes, chats and reminders, students can learn, practise and organise their work in one study space.</p>
        </div>
        <div className="landing-feature-grid">
          <article><span><ChatIcon name="chat" /></span><h3>AI study help</h3><p>Ask questions and get clear explanations suited to the topic and study mode.</p></article>
          <article><span><ChatIcon name="compose" /></span><h3>Quizzes & practice</h3><p>Test understanding, identify weak areas and learn from each attempt.</p></article>
          <article><span><ChatIcon name="calendar" /></span><h3>Plans & tasks</h3><p>Turn assignments and goals into manageable study sessions.</p></article>
          <article><span><ChatIcon name="chart" /></span><h3>Progress tracking</h3><p>See study activity, completed work and areas that need more practice.</p></article>
        </div>
      </section>

      <section className="landing-school-section" id="schools" aria-labelledby="school-title">
        <div>
          <p className="landing-kicker">FOR SCHOOLS</p>
          <h2 id="school-title">A calmer way to support independent learning.</h2>
        </div>
        <div className="landing-school-copy">
          <p>Study AI gives students a structured place to revise, practise and ask for help outside the classroom. Schools can use a branded version with account management and a dashboard for support.</p>
          <ul>
            <li>Supports students across subjects and study levels</li>
            <li>Encourages understanding, not just copied answers</li>
            <li>Gives administrators account and usage controls</li>
          </ul>
        </div>
      </section>

      <section className="landing-contact" id="contact" aria-labelledby="contact-title">
        <div>
          <p className="landing-kicker">LET’S TALK</p>
          <h2 id="contact-title">Interested in Study AI for your school?</h2>
          <p>Get in touch to arrange a demonstration or discuss a school-branded version.</p>
        </div>
        <a href="mailto:support@studyai.name.ng">support@studyai.name.ng <span aria-hidden="true">↗</span></a>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Study AI</span>
        <a href="/login" onClick={handleLogin}>Student sign in</a>
      </footer>
    </main>
  );
}

export default LandingPage;

