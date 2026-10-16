import './styles/welcome.css'

export default function Welcome() {
  return (
    <div className="welcome">
      <header className="welcome-nav">
        <a href="/" className="welcome-brand">STARKX</a>
        <a href="/app">Abrir o app →</a>
      </header>
      <main>
        <section className="welcome-hero">
          <div>
            <p className="welcome-eyebrow">Engenharia de fundações · Beta gratuito</p>
            <h1>Conheça o solo.<br />Explore a fundação.</h1>
            <p className="welcome-intro">Reúna sondagens e cargas, compare métodos de capacidade e visualize os resultados do seu estudo em um só lugar.</p>
            <a href="/app" className="welcome-cta">Começar gratuitamente <span aria-hidden="true">→</span></a>
            <p className="welcome-caption">Sem cadastro. Sem cartão de crédito.</p>
          </div>
          <div className="welcome-profile" aria-label="Ilustração esquemática de uma fundação; não representa um cálculo">
            <span className="welcome-profile-label">DO SOLO À SOLUÇÃO</span>
            <div className="welcome-soil"><span>01 / Sondagem</span><div className="welcome-pile" /></div>
            <div className="welcome-soil"><span>02 / Cargas</span></div>
            <div className="welcome-soil"><span>03 / Estudo</span></div>
            <p>Entenda os dados. Compare os resultados. Revise a solução.</p>
          </div>
        </section>
        <section className="welcome-features" aria-label="Recursos do StarkX">
          <article><span>01</span><h2>Organize as entradas</h2><p>Cadastre o perfil de sondagem, o nível d’água e as cargas do projeto.</p></article>
          <article><span>02</span><h2>Compare os métodos</h2><p>Explore Aoki-Velloso, Décourt-Quaresma e Teixeira para capacidade de estacas.</p></article>
          <article><span>03</span><h2>Revise e documente</h2><p>Consulte visualizações, resultados e o memorial com o escopo de cada verificação.</p></article>
        </section>
        <section className="welcome-notes">
          <div><h2>Seus projetos, neste navegador</h2><p>O salvamento é local. Não há sincronização entre aparelhos. Exporte uma cópia do projeto antes de limpar os dados do navegador ou mudar de computador.</p></div>
          <div><h2>Um apoio ao seu estudo</h2><p>O StarkX está em beta e entrega pré-dimensionamento. Confira o escopo indicado em cada resultado e faça a revisão técnica antes de usar o estudo em um projeto executivo.</p></div>
        </section>
      </main>
      <footer className="welcome-footer">STARKX · software livre (AGPL-3.0) · gratuito.</footer>
    </div>
  )
}
