/*
Luna que rebota (estética universo):
- Fondo con degradado + estrellas titilantes.
- La Luna rebota por los cuatro bordes; mientras el cursor está encima
  crece (hasta la mitad del canvas) y cambia de fase (llena -> media -> menguante).
- Al hacer clic caen estrellas fugaces del cursor durante 8 segundos (partículas).
- Emite un sonido en cada rebote (p5.sound).
*/

let posX, posY;        // posición
let velX, velY;        // velocidad
let diametro = 50;
let radio = diametro / 2;

let t = 0;             // reloj del ruido (movimiento)
let tiempo = 0;        // reloj de animación (estrellas, cráteres)

let escala = 1;        // tamaño de la Luna
let escalaMax = 1;     // tope: la Luna no pasa de la mitad del canvas

let fases = [];        // fases lunares {f, claro, oscuro}
let crateres = [];     // cráteres (posiciones relativas)
let estrellas = [];    // estrellas de fondo

// Sistema de partículas (estrellas fugaces que caen del cursor)
let particulas = [];
let lluviaActiva = false;
let lluviaFin = 0;     // instante en ms en que termina la emisión
const DURACION_LLUVIA = 8000;
const MAX_PARTICULAS = 500;

let osc, envolvente;   // sonido del rebote

function setup() {
    createCanvas(windowWidth, windowHeight);

    posX = width / 2;
    posY = height * 0.72;
    // Arranca con una dirección aleatoria y buena velocidad.
    let angulo = random(TWO_PI);
    let rapidez = random(6, 9);
    velX = cos(angulo) * rapidez;
    velY = sin(angulo) * rapidez;

    // Tope de crecimiento: el diámetro máximo es la mitad del lado menor.
    escalaMax = (min(width, height) / 2) / (2 * radio);

    // Fases: f = fracción iluminada (1 = llena, 0.5 = media, 0.2 = menguante).
    fases = [
        { f: 1.0, claro: color(255, 255, 250), oscuro: color(205, 210, 230) }, // llena
        { f: 0.5, claro: color(250, 250, 255), oscuro: color(190, 195, 220) }, // media
        { f: 0.2, claro: color(240, 244, 255), oscuro: color(175, 180, 210) }  // menguante
    ];

    // Cráteres: posiciones y tamaños relativos al radio (generados al azar).
    crateres = [];
    for (let i = 0; i < 24; i++) {
        let a = random(TWO_PI);
        let d = sqrt(random()) * 0.82;
        crateres.push({ x: cos(a) * d, y: sin(a) * d, tam: random(0.05, 0.17) });
    }

    // Estrellas del fondo.
    for (let i = 0; i < 200; i++) {
        estrellas.push({
            x: random(width),
            y: random(height),
            tam: random(0.6, 2.4),
            fase: random(TWO_PI),
            vel: random(1, 3),
            brillo: random(150, 255)
        });
    }

    // Un oscilador suave con una envolvente corta: "blip" en cada rebote.
    osc = new p5.Oscillator('sine');
    envolvente = new p5.Envelope();
    envolvente.setADSR(0.001, 0.05, 0, 0.1);
    envolvente.setRange(0.4, 0);
    osc.amp(envolvente);
    osc.start();
}

function draw() {
    clear(); // el fondo base es el degradado CSS del body
    tiempo += 0.04;
    t += 0.006;

    dibujarEstrellas();
    dibujarTitulo();

    let r = radio * escala;
    let encima = dist(mouseX, mouseY, posX, posY) < r;

    // Crece SIN límite infinito: se detiene al llegar a la mitad del canvas.
    if (encima && escala < escalaMax) {
        escala = min(escala + 0.007, escalaMax);
    } else if (!encima) {
        mover(r);
    }

    dibujarLuna(r, encima);
    actualizarLluvia();
    dibujarParticulas();
}

function dibujarEstrellas() {
    noStroke();
    for (let e of estrellas) {
        let a = e.brillo * (0.35 + 0.65 * (0.5 + 0.5 * sin(tiempo * e.vel + e.fase)));
        fill(255, 255, 255, a);
        circle(e.x, e.y, e.tam);
    }
}

function dibujarTitulo() {
    push();
    textAlign(CENTER, CENTER);
    textFont('Fredoka');
    textSize(34);
    noStroke();
    drawingContext.shadowBlur = 18;
    drawingContext.shadowColor = 'rgba(210, 225, 255, 0.9)';
    fill(255);
    text('Luna que rebota', width / 2, height * 0.25);
    pop();
}

// Mezcla entre dos fases consecutivas según cuánto haya crecido.
function faseActual() {
    let n = fases.length;
    let pos = (escala - 1) * 1.2;         // cada 1/1.2 de escala, una fase nueva
    let i = floor(pos) % n;
    if (i < 0) i += n;
    let j = (i + 1) % n;
    let mezcla = pos - floor(pos);
    return {
        f: lerp(fases[i].f, fases[j].f, mezcla),
        claro: lerpColor(fases[i].claro, fases[j].claro, mezcla),
        oscuro: lerpColor(fases[i].oscuro, fases[j].oscuro, mezcla)
    };
}

// Contorno de la parte iluminada (lado derecho) para una fracción f (0..1).
function trazarFase(cx, cy, r, f) {
    let e = r * Math.abs(2 * f - 1);      // semiancho de la elipse "terminador"
    const c = drawingContext;
    c.beginPath();
    // mitad derecha del disco (de arriba a abajo)
    c.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    if (f >= 0.5) {
        // gibosa: borde interior = mitad izquierda de la elipse
        c.ellipse(cx, cy, e, r, 0, Math.PI / 2, 1.5 * Math.PI, false);
    } else {
        // creciente: borde interior = mitad derecha de la elipse
        c.ellipse(cx, cy, e, r, 0, Math.PI / 2, -Math.PI / 2, true);
    }
    c.closePath();
}

function dibujarLuna(r, encima) {
    let fase = faseActual();
    const c = drawingContext;

    // 1) Halo exterior brillante.
    c.save();
    let halo = c.createRadialGradient(posX, posY, r * 0.85, posX, posY, r * 2.0);
    halo.addColorStop(0, 'rgba(220, 235, 255, 0.40)');
    halo.addColorStop(0.5, 'rgba(200, 220, 255, 0.12)');
    halo.addColorStop(1, 'rgba(200, 220, 255, 0)');
    c.beginPath();
    c.arc(posX, posY, r * 2.0, 0, Math.PI * 2);
    c.fillStyle = halo;
    c.fill();
    c.restore();

    // 2) Disco base, en penumbra (parte no iluminada).
    c.save();
    let gd = c.createRadialGradient(posX - r * 0.3, posY - r * 0.3, r * 0.1, posX, posY, r);
    gd.addColorStop(0, 'rgba(70, 78, 110, 1)');
    gd.addColorStop(1, 'rgba(34, 39, 62, 1)');
    c.beginPath();
    c.arc(posX, posY, r, 0, Math.PI * 2);
    c.fillStyle = gd;
    c.fill();
    c.restore();

    // 3) Parte iluminada: relleno blanco con resplandor fuerte (da el brillo).
    c.save();
    c.shadowBlur = 45;
    c.shadowColor = 'rgba(240, 245, 255, 0.95)';
    trazarFase(posX, posY, r, fase.f);
    c.fillStyle = '#ffffff';
    c.fill();
    c.restore();

    // 4) Textura sobre la parte iluminada (gradiente + cráteres con relieve).
    c.save();
    trazarFase(posX, posY, r, fase.f);
    c.clip();
    let gl = c.createRadialGradient(posX - r * 0.35, posY - r * 0.35, r * 0.05, posX, posY, r * 1.05);
    gl.addColorStop(0, '#ffffff');
    gl.addColorStop(0.55, fase.claro.toString());
    gl.addColorStop(1, fase.oscuro.toString());
    c.fillStyle = gl;
    c.fillRect(posX - r, posY - r, 2 * r, 2 * r);

    for (let cr of crateres) {
        let x = posX + cr.x * r, y = posY + cr.y * r, crr = cr.tam * r;
        c.beginPath();
        c.arc(x, y, crr, 0, Math.PI * 2);
        c.fillStyle = 'rgba(70, 75, 105, 0.22)';
        c.fill();
        c.beginPath();
        c.arc(x - crr * 0.28, y - crr * 0.28, crr * 0.68, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.20)';
        c.fill();
    }
    c.restore();

    // 5) Brillo especular (luz reflejada arriba-izquierda).
    c.save();
    trazarFase(posX, posY, r, fase.f);
    c.clip();
    let spec = c.createRadialGradient(posX - r * 0.4, posY - r * 0.42, 0, posX - r * 0.4, posY - r * 0.42, r * 0.7);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = spec;
    c.fillRect(posX - r, posY - r, 2 * r, 2 * r);
    c.restore();

    // Mensaje mientras crece / al llegar al tope.
    if (encima) {
        push();
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textFont('Fredoka');
        textSize(14);
        text(escala < escalaMax ? '¡Creciendo!' : '¡Tamaño máximo!', posX, posY + r + 18);
        pop();
    }
}

// ---------- Sistema de partículas: estrellas fugaces del cursor ----------

function iniciarLluvia() {
    lluviaActiva = true;
    lluviaFin = millis() + DURACION_LLUVIA;
}

function nuevaParticula(x, y) {
    // Estrella fugaz: sale del cursor hacia abajo con una inclinación al azar.
    let ang = random(Math.PI * 0.15, Math.PI * 0.85);
    let vel = random(8, 16);
    let vida = random(45, 100);
    return {
        x: x + random(-10, 10),
        y: y + random(-10, 10),
        vx: cos(ang) * vel,
        vy: sin(ang) * vel,
        largo: vel * 3.5,          // longitud de la cola
        grosor: random(1.2, 3),
        vida: vida,
        vidaMax: vida,
        pulso: random(TWO_PI),
        color: random([[255, 255, 255], [198, 220, 255], [255, 236, 190]])
    };
}

function actualizarLluvia() {
    // Emite durante 8 segundos (o hasta llegar al máximo de partículas).
    if (lluviaActiva && millis() < lluviaFin) {
        for (let i = 0; i < 2 && particulas.length < MAX_PARTICULAS; i++) {
            particulas.push(nuevaParticula(mouseX, mouseY));
        }
    } else {
        lluviaActiva = false;
    }

    // Física: caen con una gravedad suave y se van desvaneciendo.
    for (let i = particulas.length - 1; i >= 0; i--) {
        let p = particulas[i];
        p.vy += 0.06;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.vida--;
        if (p.vida <= 0 || p.y > height + 80 || p.x < -80 || p.x > width + 80) {
            particulas.splice(i, 1);
        }
    }
}

function dibujarParticulas() {
    const c = drawingContext;
    c.save();
    c.lineCap = 'round';
    for (let p of particulas) {
        let a = 255 * (p.vida / p.vidaMax);
        a *= 0.65 + 0.35 * sin(tiempo * 8 + p.pulso);

        // Cola: degradado desde la cabeza hasta la estela.
        let mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        let dx = p.vx / mag, dy = p.vy / mag;
        let tx = p.x - dx * p.largo, ty = p.y - dy * p.largo;

        let grad = c.createLinearGradient(p.x, p.y, tx, ty);
        grad.addColorStop(0, 'rgba(255, 255, 255, ' + (a / 255) + ')');
        grad.addColorStop(0.35, 'rgba(' + p.color[0] + ',' + p.color[1] + ',' + p.color[2] + ',' + (a / 255 * 0.55) + ')');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        c.strokeStyle = grad;
        c.lineWidth = p.grosor;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(tx, ty);
        c.stroke();

        // Cabeza brillante.
        c.shadowBlur = 16;
        c.shadowColor = 'rgba(255, 255, 255, 0.95)';
        c.fillStyle = 'rgba(255, 255, 255, ' + (a / 255) + ')';
        c.beginPath();
        c.arc(p.x, p.y, p.grosor, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
    }
    c.restore();
}

// ------------------------------------------------------------------------

function mover(r) {
    // 1) "Viento" suave: la dirección cambia de a poco, sin saltos bruscos.
    velX += map(noise(t), 0, 1, -0.15, 0.15);
    velY += map(noise(t + 100), 0, 1, -0.15, 0.15);

    // 2) Mantiene una rapidez estable y rápida.
    let rapidez = sqrt(velX * velX + velY * velY) || 0.0001;
    let objetivo = map(noise(t + 300), 0, 1, 6, 10);
    let nueva = constrain(lerp(rapidez, objetivo, 0.08), 6, 10);
    velX = (velX / rapidez) * nueva;
    velY = (velY / rapidez) * nueva;

    // Seguro: si por lo que sea se queda sin velocidad, la relanza.
    if (nueva < 1) {
        let angulo = random(TWO_PI);
        velX = cos(angulo) * 7;
        velY = sin(angulo) * 7;
    }

    // 3) Avanza.
    posX += velX;
    posY += velY;

    // 4) Rebota en los cuatro bordes. Si la Luna ya es más grande que la
    //    pantalla, se limita el radio usado para los rebotes para que no se trabe.
    let rb = min(r, min(width, height) / 2);
    if (posX < rb) {
        posX = rb;
        velX = abs(velX);
        rebotar(abs(velX));
    } else if (posX > width - rb) {
        posX = width - rb;
        velX = -abs(velX);
        rebotar(abs(velX));
    }

    if (posY < rb) {
        posY = rb;
        velY = abs(velY);
        rebotar(abs(velY));
    } else if (posY > height - rb) {
        posY = height - rb;
        velY = -abs(velY);
        rebotar(abs(velY));
    }
}

// Reproduce el sonido del rebote. `fuerza` determina el tono y el volumen.
function rebotar(fuerza) {
    fuerza = fuerza || 6;
    let volumen = constrain(map(fuerza, 0, 12, 0.15, 1), 0.15, 1);
    let tono = constrain(map(fuerza, 0, 12, 250, 800), 200, 1000);

    osc.freq(tono);
    envolvente.setRange(volumen, 0);
    envolvente.play();
}

// Los navegadores no dejan sonar hasta que el usuario interactúa.
// El clic también inicia la lluvia de estrellas.
function mousePressed() {
    userStartAudio();
    iniciarLluvia();
}

function touchStarted() {
    userStartAudio();
    iniciarLluvia();
}
