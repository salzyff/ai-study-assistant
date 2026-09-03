import { useState } from "react";
import LearningReview from "./LearningReview";
import QuestionBank from "./QuestionBank";
import StudyGoals from "./StudyGoals";
import TeachBack from "./TeachBack";

function LearningCenter({ accessToken }) {
  const [section, setSection] = useState("review");

  return (
    <section>
      <h1>Learning Center</h1>
      <p>
        <button type="button" onClick={() => setSection("review")}>Daily review and mistakes</button>{" "}
        <button type="button" onClick={() => setSection("teach")}>Teach-back and marking</button>{" "}
        <button type="button" onClick={() => setSection("bank")}>Practice question bank</button>{" "}
        <button type="button" onClick={() => setSection("goals")}>Study goals</button>
      </p>
      {section === "review" && <LearningReview accessToken={accessToken} />}
      {section === "teach" && <TeachBack accessToken={accessToken} />}
      {section === "bank" && <QuestionBank accessToken={accessToken} />}
      {section === "goals" && <StudyGoals accessToken={accessToken} />}
    </section>
  );
}

export default LearningCenter;
