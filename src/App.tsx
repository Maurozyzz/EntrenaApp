import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { SupabaseStatus } from './components/SupabaseStatus';

function App() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--oc-space-5)',
        textAlign: 'center',
        gap: 'var(--oc-space-4)',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--oc-font-body)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: 'var(--oc-energy)',
          textTransform: 'uppercase',
        }}
      >
        Origen Coaching
      </span>
      <h1
        style={{
          fontSize: 'clamp(22px, 7vw, 32px)',
          color: 'var(--oc-gold)',
          width: '100%',
          maxWidth: 420,
          minWidth: 0,
        }}
      >
        App del entrenador
      </h1>
      <Card style={{ width: '100%', maxWidth: 420, minWidth: 0, boxSizing: 'border-box' }}>
        <p style={{ color: 'var(--oc-text-muted)', marginBottom: 'var(--oc-space-4)' }}>
          Base de estilos lista: fondo, dorado, verde lima y tipografías Montserrat + Cinzel.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--oc-space-3)',
            justifyContent: 'center',
          }}
        >
          <Button variant="primary">Acción principal</Button>
          <Button variant="secondary">Secundaria</Button>
        </div>
      </Card>
      <SupabaseStatus />
    </div>
  );
}

export default App;
