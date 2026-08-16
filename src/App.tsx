import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { useAuth } from './lib/AuthContext';
import { Login } from './pages/Login';
import { CoachStudents } from './pages/coach/CoachStudents';
import { CoachExercises } from './pages/coach/CoachExercises';
import { CoachStudentDetail } from './pages/coach/CoachStudentDetail';
import { StudentHome } from './pages/student/StudentHome';
import { StudentRoutine } from './pages/student/StudentRoutine';
import { StudentProgress } from './pages/student/StudentProgress';
import { StudentNutrition } from './pages/student/StudentNutrition';
import { StudentPayments } from './pages/student/StudentPayments';

function RoleHome() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === 'trainer' ? '/coach' : '/mi'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <RoleHome />
          </RequireAuth>
        }
      />

      <Route
        path="/coach"
        element={
          <RequireAuth role="trainer">
            <CoachStudents />
          </RequireAuth>
        }
      />
      <Route
        path="/coach/ejercicios"
        element={
          <RequireAuth role="trainer">
            <CoachExercises />
          </RequireAuth>
        }
      />
      <Route
        path="/coach/alumnos/:id"
        element={
          <RequireAuth role="trainer">
            <CoachStudentDetail />
          </RequireAuth>
        }
      />

      <Route
        path="/mi"
        element={
          <RequireAuth role="student">
            <StudentHome />
          </RequireAuth>
        }
      />
      <Route
        path="/mi/rutina"
        element={
          <RequireAuth role="student">
            <StudentRoutine />
          </RequireAuth>
        }
      />
      <Route
        path="/mi/progreso"
        element={
          <RequireAuth role="student">
            <StudentProgress />
          </RequireAuth>
        }
      />
      <Route
        path="/mi/nutricion"
        element={
          <RequireAuth role="student">
            <StudentNutrition />
          </RequireAuth>
        }
      />
      <Route
        path="/mi/pagos"
        element={
          <RequireAuth role="student">
            <StudentPayments />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
