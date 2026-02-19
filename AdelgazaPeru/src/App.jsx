import { useState } from 'react'

function App() {
  const [videoOpen, setVideoOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const toggleVideo = () => {
    setVideoOpen(!videoOpen)
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: "¿Cuánto tiempo dura el programa?",
      answer: "El programa tiene una duración de 28 días, pero las herramientas y el conocimiento que aprendes te acompañan para siempre."
    },
    {
      question: "¿Necesito comprar alimentos especiales?",
      answer: "No. El programa se basa en alimentos reales y accesibles en cualquier supermercado. No requerimos productos costosos o difíciles de encontrar."
    },
    {
      question: "¿Qué pasa si no veo resultados?",
      answer: "Trabajamos contigo de manera personalizada. Si sigues las recomendaciones y no ves resultados, nuestro equipo ajusta tu plan para asegurar tu éxito."
    },
    {
      question: "¿Puedo hacer el programa desde cualquier lugar?",
      answer: "Sí. Todo el contenido y acompañamiento es online, así que puedes participar desde cualquier ciudad o país."
    },
    {
      question: "¿Necesito hacer ejercicio intenso?",
      answer: "No. El programa se adapta a tu nivel de actividad física actual. Incluimos recomendaciones de movimiento suave y progresivo."
    }
  ]

  const pillars = [
    {
      icon: "🍽️",
      title: "Nutrición Consciente",
      text: "Aprende a comer sin culpa, sin contar calorías y sin privarte de lo que te gusta."
    },
    {
      icon: "🧠",
      title: "Psiconutrición",
      text: "Transforma tu relación con la comida y supera los bloqueos emocionales."
    },
    {
      icon: "💪",
      title: "Movimiento Natural",
      text: "Actividad física que se adapta a tu vida, no al revés."
    },
    {
      icon: "😴",
      title: "Descanso Profundo",
      text: "Técnicas para mejorar tu sueño y recuperación."
    },
    {
      icon: "📱",
      title: "Acompañamiento Diario",
      text: "Equipo experto disponible para ti en cada paso del camino."
    }
  ]

  const timeline = [
    {
      title: "Semana 1: Fundamentos",
      desc: "Conoces tu cuerpo, estableces hábitos y recibes tu plan personalizado."
    },
    {
      title: "Semana 2: Transformación",
      desc: "Implementas los cambios, aprendes a leer las señales de tu cuerpo."
    },
    {
      title: "Semana 3: Consolidación",
      desc: "Los nuevos hábitos se vuelven automáticos y ves los primeros resultados."
    },
    {
      title: "Semana 4: Tu Nueva Versión",
      desc: "Refuerzas lo aprendido, celebras tu cambio y recibes herramientas para mantenerte."
    }
  ]

  const testimonials = [
    {
      text: "Perdí 6 kg en 28 días sin pasar hambre. El acompañamiento fue increíble, siempre alguien ahí para resolver mis dudas.",
      author: "María, 34 años"
    },
    {
      text: "Después de años de dietas yo-yo, finalmente encontré un método que funciona. No solo bajé de peso, sino que recuperé mi energía.",
      author: "Carmen, 42 años"
    },
    {
      text: "Lo que más me gustó fue que no tuve que dejar de comer lo que me gusta. Aprendí a balancear todo.",
      author: "Ana, 29 años"
    }
  ]

  const problems = [
    "Sientes que has intentado de todo y nada funciona",
    "Te da culpa cada vez que comes algo 'no permitido'",
    "Miras ropa que te gusta pero ya no te sientes cómoda",
    "Has probado mil dietas y siempre vuelves al mismo punto",
    "Sientes que te falta fuerza de voluntad"
  ]

  const features = [
    {
      title: "Más que un número en la balanza",
      text: "Hablamos de recuperar tu energía, tus ganas de arreglarte, de salir en fotos, de mirarte al espejo sin criticarte."
    },
    {
      title: "Sin pelear con la comida",
      text: "Aprendes a comer rico y consciente, sin miedo a engordar por cada salida, viaje o antojo."
    },
    {
      title: "Resultados sin rebote",
      text: "Aprendes las herramientas para mantener tu peso ideal a largo plazo, sin efectos yo-yo."
    }
  ]

  return (
    <div className="app">
      <div className="bg-fixed"></div>
      
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="logo">
            <img 
              src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/YKraaURUAlOpzHhLXiNT/media/695e9f7f49ed62252c388372.png" 
              alt="Adelgaza Perú" 
            />
          </div>
          
          <p className="hero-subtitle">RETO DE 28 DÍAS · 100% PERSONALIZADO</p>
          
          <h1 className="hero-title">
            Pierde <strong>4 a 8 kg en 28 días</strong><br />
            sin dietas extremas ni vivir en el gym
          </h1>
          
          <p className="hero-description">
            Programa online para mujeres que ya lo intentaron todo. Sin contar calorías, 
            sin pasar hambre y sin rebote, con un equipo experto que te acompaña paso a paso.
          </p>

          {/* Video */}
          <div className="video-container" onClick={toggleVideo}>
            {videoOpen ? (
              <iframe
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                title="Video de presentación"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="video-placeholder">
                <div className="play-button"></div>
              </div>
            )}
          </div>

          <button className="cta-button" onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}>
            Reserva tu evaluación
          </button>

          <ul className="feature-list">
            <li>Sin dietas extremas ni pastillas milagro</li>
            <li>Plan 100% personalizado según tu cuerpo y tu rutina</li>
            <li>Acompañamiento diario por nutrición y psiconutrición</li>
            <li>Resultados reales sin efecto rebote</li>
          </ul>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">TE ENTENDEMOS</p>
            <h2 className="section-title">
              No es falta de fuerza de voluntad.<br />
              Es falta de un plan hecho para ti.
            </h2>
          </div>
          
          <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px', color: '#b39ad8', lineHeight: 1.8 }}>
            Si estás cansada de empezar "el lunes", de sentir culpa cada vez que comes algo rico y 
            de mirar ropa que te encanta pero que ya no se siente cómoda, no estás sola. Acompañamos 
            a mujeres como tú todos los días en Adelgaza Perú.
          </p>

          <div className="card-grid">
            {features.map((feature, index) => (
              <div className="card" key={index}>
                <h3 className="card-title">{feature.title}</h3>
                <p className="card-text">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Warning Section */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">SI TE SIENTES ASÍ, ES POR ALGO</p>
            <h2 className="section-title">Da el primer paso hoy</h2>
          </div>
          
          <ul className="feature-list" style={{ maxWidth: '600px', margin: '0 auto' }}>
            {problems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">EVIDENCIA, NO PROMESAS VACÍAS</p>
            <h2 className="section-title">Más de 1,500 mujeres han pasado por el Reto de 28 Días</h2>
          </div>
          
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-number">1,500+</div>
              <div className="stat-label">Mujeres transformadas</div>
            </div>
            <div className="stat">
              <div className="stat-number">98%</div>
              <div className="stat-label">Recomendaría el programa</div>
            </div>
            <div className="stat">
              <div className="stat-number">4-8kg</div>
              <div className="stat-label">Pérdida de peso promedio</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">TODO LO QUE NECESITAS, EN UN SOLO PROGRAMA</p>
            <h2 className="section-title">5 pilares para bajar de peso sin destruir tu relación con la comida</h2>
          </div>
          
          <div className="pillars-grid">
            {pillars.map((pillar, index) => (
              <div className="pillar" key={index}>
                <div className="pillar-icon">{pillar.icon}</div>
                <h3 className="pillar-title">{pillar.title}</h3>
                <p className="pillar-text">{pillar.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="section" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">ASÍ SON TUS 28 DÍAS</p>
            <h2 className="section-title">Un mapa claro desde el día 1 hasta ver tu nueva versión en el espejo</h2>
          </div>
          
          <div className="timeline">
            {timeline.map((item, index) => (
              <div className="timeline-item" key={index}>
                <div className="timeline-number">{index + 1}</div>
                <div className="timeline-content">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">TESTIMONIOS</p>
            <h2 className="section-title">Mujeres reales, resultados reales</h2>
          </div>
          
          <div className="testimonial-grid">
            {testimonials.map((testimonial, index) => (
              <div className="testimonial" key={index}>
                <p className="testimonial-text">"{testimonial.text}"</p>
                <p className="testimonial-author">{testimonial.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="container">
          <div className="section-header">
            <p className="section-subtitle">PREGUNTAS FRECUENTES</p>
            <h2 className="section-title">Resolvemos tus dudas antes de que des el paso</h2>
          </div>
          
          <div className="faq-container">
            {faqs.map((faq, index) => (
              <div className="faq-item" key={index}>
                <div className="faq-question" onClick={() => toggleFaq(index)}>
                  {faq.question}
                  <span>{openFaq === index ? '−' : '+'}</span>
                </div>
                {openFaq === index && (
                  <div className="faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta section" id="contacto">
        <div className="container">
          <p className="section-subtitle">LISTA PARA TU CAMBIO</p>
          <h2 className="section-title">Da el primer paso hoy. El resto lo construimos juntos.</h2>
          <p className="section-subtitle" style={{ color: '#b39ad8' }}>
            Tu evaluación personalizada te espera
          </p>
          
          <button className="cta-button">
            Reserva tu evaluación
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-logo">Adelgaza Perú</div>
          <p className="footer-text">
            © 2024 Adelgaza Perú. Todos los derechos reservados.<br />
            Transformando vidas, un paso a la vez.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
