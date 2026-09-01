import type { Route } from "./+types/home";
import Navbar from "../../components/Navbar";
import { ArrowUpRight, Clock } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { getProjects } from "../../lib/puter.action";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<DesignItem[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      const items = await getProjects();
      setProjects(items);
    };

    fetchProjects();
  }, []);

  return (
    <div className="home">
      <Navbar />

      <section className="hero">
        <div className="announce">
          <div className="dot">
            <div className="pulse"></div>
          </div>
          <p>Introducing Roomify 2.0</p>
        </div>
        <h1>Build beautiful spaces at the speed of thought with Roomify</h1>
        <p className="subtitle">
          Roomify is an Ai-first design environment that helps you
          visualize,render, and ship architectural projects faster than ever.
        </p>
        <div className="actions">
          <Button variant="outline" size="lg" className="demo">
            Watch Demo
          </Button>
        </div>
      </section>
      <section className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2>projects</h2>
              <p>
                Your latest work and shared community projects, all in one
                place.
              </p>
            </div>
          </div>
          <div className="projects-grid">
            {projects.map(
              ({ id, name, renderedImage, sourceImage, timestamp }) => (
                <div
                  className="project-card group"
                  key={id}
                  onClick={() => navigate(`/visualizer/${id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      navigate(`/visualizer/${id}`);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <div className="preview">
                    <img
                      src={renderedImage || sourceImage}
                      alt="project-preview"
                    />
                    <div className="badge">
                      <span>Community</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div>
                      <h3>{name}</h3>
                      <div className="meta">
                        <Clock size={12} />
                        <span>
                          {new Date(timestamp).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                        <span>By Hari</span>
                      </div>
                    </div>
                    <div className="arrow">
                      <ArrowUpRight size="18" />
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
