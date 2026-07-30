import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  Sparkles,
  Images,
  Lamp,
  CheckCircle2,
  ArrowRight,
  FolderKanban,
} from 'lucide-react';

import {
  getDashboardData,
  type DashboardData,
} from '../lib/dashboardService';

const emptyDashboard: DashboardData = {
  productCount: 0,
  visualCount: 0,
  approvedProjectCount: 0,
  projectCount: 0,
  recentProjects: [],
};

export default function Dashboard() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<DashboardData>(
      emptyDashboard
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMsg,
    setErrorMsg,
  ] =
    useState('');

  useEffect(() => {
    async function load() {
      try {
        setErrorMsg('');

        const data =
          await getDashboardData();

        setDashboard(data);
      } catch (error) {
        console.error(
          'Dashboard load failed:',
          error
        );

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to load dashboard.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">
            CASANI CREATIVE SYSTEM
          </p>

          <h1>
            Turn product photos into
            premium lighting campaigns.
          </h1>

          <p>
            Upload a lamp photo, select
            space and mood, then create
            ready-to-use campaign visuals.
          </p>
        </div>

        <Link
          className="btn primary"
          to="/create"
        >
          <Sparkles size={18} />
          Create new visual
        </Link>
      </header>

      {errorMsg && (
        <div className="empty">
          {errorMsg}
        </div>
      )}

      <section className="stats">
        <Card
          i={<Lamp />}
          n={dashboard.productCount}
          t="Sản phẩm"
        />

        <Card
          i={<Images />}
          n={dashboard.visualCount}
          t="AI visuals"
        />

        <Card
          i={<FolderKanban />}
          n={dashboard.projectCount}
          t="Dự án"
        />

        <Card
          i={<CheckCircle2 />}
          n={
            dashboard.approvedProjectCount
          }
          t="Approved projects"
        />
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">
              RECENT WORK
            </p>

            <h2>
              Recent projects
            </h2>
          </div>

          <Link to="/projects">
            View all
            <ArrowRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="empty">
            Loading dashboard...
          </div>
        ) : dashboard.recentProjects.length ? (
          <div className="grid cards">
            {dashboard.recentProjects.map(
              (project) => (
                <Link
                  to={
                    '/results/' +
                    project.id
                  }
                  className="projectCard"
                  key={project.id}
                >
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={
                        project.productName
                      }
                    />
                  ) : (
                    <div className="projectPlaceholder">
                      No visual yet
                    </div>
                  )}

                  <div>
                    <b>
                      {
                        project.productName
                      }
                    </b>

                    <span>
                      {project.style ||
                        '—'}

                      {' · '}

                      {project.space ||
                        '—'}
                    </span>

                    <small>
                      {statusLabel(
                        project.status
                      )}
                    </small>
                  </div>
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="empty">
            No projects yet. Create the
            first campaign visual.
          </div>
        )}
      </section>
    </>
  );
}

function statusLabel(
  status: string
) {
  switch (status) {
    case 'approved':
      return '✓ Approved';

    case 'completed':
      return 'Hoàn thành';

    case 'generating':
      return 'Đang tạo...';

    case 'failed':
      return 'Tạo ảnh thất bại';

    case 'draft':
    default:
      return 'Bản nháp';
  }
}

function Card({
  i,
  n,
  t,
}: {
  i: React.ReactNode;
  n: number;
  t: string;
}) {
  return (
    <div className="stat">
      <div className="iconbox">
        {i}
      </div>

      <div>
        <b>{n}</b>
        <span>{t}</span>
      </div>
    </div>
  );
}
