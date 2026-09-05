// ============================================================
// WILD HASTHI POS
// SUPABASE CLOUD DATABASE VERSION
// ============================================================
//
// Supabase client is created in index.html:
//
// window.supabaseApp
//
// DO NOT create another Supabase client in this file.
// ============================================================


// ============================================================
// RATE MATRIX
// DO NOT CHANGE THESE RATES
// ============================================================

const RATE_MATRIX = {
  '1 adult': {
    HB: 330,
    AI: 430
  },

  '2 adults': {
    HB: 330,
    AI: 430
  },

  '3 adults': {
    HB: 405,
    AI: 530
  },

  '2 adults + 1 child 6-11': {
    HB: 370,
    AI: 485
  },

  '2 adults + 2 children 6-11': {
    HB: 410,
    AI: 540
  }
};


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentFilter = 'all';
let cart = [];
let realtimeStarted = false;

window.currentGuest = null;
window.reservations = [];


// ============================================================
// SUPABASE CLIENT
// ============================================================

function getSupabase() {
  return window.supabaseApp || null;
}


function isSupabaseReady() {

  const client = getSupabase();

  if (!client) {
    console.error('Supabase client is not available.');
    return false;
  }

  if (!client.auth) {
    console.error('Supabase Auth is not available.');
    return false;
  }

  return true;
}


// ============================================================
// DATE HELPERS
// ============================================================

function getTodayString() {

  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function getTomorrowString() {

  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function getCurrentMonthString() {

  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}


function formatDate(dateString) {

  if (!dateString) return '';

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}


function formatMoney(amount) {

  return `$ ${Number(amount || 0).toFixed(2)}`;
}


// ============================================================
// LOGIN SCREEN
// ============================================================

function showLoginScreen() {

  const overlay =
    document.getElementById('loginOverlay');

  if (overlay) {
    overlay.classList.remove('hidden');
  }
}


function hideLoginScreen() {

  const overlay =
    document.getElementById('loginOverlay');

  if (overlay) {
    overlay.classList.add('hidden');
  }
}


// ============================================================
// LOGIN
// ============================================================

async function handleLogin(event) {

  if (event) {
    event.preventDefault();
  }

  const emailInput =
    document.getElementById('loginEmail');

  const passwordInput =
    document.getElementById('pinInput');

  const email =
    emailInput
      ? emailInput.value.trim()
      : '';

  const password =
    passwordInput
      ? passwordInput.value
      : '';

  if (!email || !password) {

    alert(
      'Please enter your email address and password.'
    );

    return;
  }


  if (!isSupabaseReady()) {

    alert(
      'Supabase is not initialized.\n\n' +
      'Please check the Supabase connection in index.html.'
    );

    return;
  }


  const button =
    event &&
    event.target &&
    event.target.querySelector(
      'button[type="submit"]'
    );


  const originalText =
    button
      ? button.textContent
      : 'Unlock Dashboard';


  try {

    if (button) {

      button.disabled = true;
      button.textContent = 'Connecting...';
    }


    console.log(
      'Attempting Supabase login...'
    );


    const supabase =
      getSupabase();


    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });


    if (error) {

      console.error(
        'Supabase login error:',
        error
      );

      alert(
        'LOGIN FAILED\n\n' +
        error.message
      );

      return;
    }


    if (!data || !data.session) {

      alert(
        'Login did not create a session.\n\n' +
        'Please check your Supabase Authentication settings.'
      );

      return;
    }


    console.log(
      'Supabase login successful.'
    );


    hideLoginScreen();


    await initApp();

  }

  catch (error) {

    console.error(
      'Unexpected login error:',
      error
    );

    alert(
      'UNEXPECTED ERROR\n\n' +
      (error.message || String(error))
    );

  }

  finally {

    if (button) {

      button.disabled = false;
      button.textContent = originalText;
    }
  }
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

  try {

    if (isSupabaseReady()) {

      const supabase =
        getSupabase();

      await supabase.auth.signOut();
    }

  }

  catch (error) {

    console.error(
      'Logout error:',
      error
    );
  }


  window.currentGuest = null;

  cart = [];

  renderCart();

  showLoginScreen();
}


// ============================================================
// CHECK AUTHENTICATION
// ============================================================

async function checkAuthentication() {

  if (!isSupabaseReady()) {

    console.error(
      'Supabase is not ready.'
    );

    showLoginScreen();

    return false;
  }


  try {

    const supabase =
      getSupabase();


    const {
      data,
      error
    } =
      await supabase.auth.getSession();


    if (error) {

      console.error(
        'Session check error:',
        error
      );

      showLoginScreen();

      return false;
    }


    if (data && data.session) {

      hideLoginScreen();

      return true;
    }


    showLoginScreen();

    return false;

  }

  catch (error) {

    console.error(
      'Authentication check failed:',
      error
    );

    showLoginScreen();

    return false;
  }
}


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  async function () {

    console.log(
      'Wild Hasthi POS starting...'
    );


    console.log(
      'Supabase client available:',
      !!window.supabaseApp
    );


    const authenticated =
      await checkAuthentication();


    if (authenticated) {

      await initApp();
    }

  }
);


// ============================================================
// INITIALIZE APP
// ============================================================

async function initApp() {

  console.log(
    'Initializing Wild Hasthi POS...'
  );


  const today =
    getTodayString();

  const tomorrow =
    getTomorrowString();


  const dateDisplay =
    document.getElementById(
      'currentDateDisplay'
    );


  if (dateDisplay) {

    dateDisplay.textContent =
      new Date().toLocaleDateString(
        'en-GB',
        {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }
      ).toUpperCase();
  }


  const checkIn =
    document.getElementById(
      'resCheckIn'
    );


  const checkOut =
    document.getElementById(
      'resCheckOut'
    );


  if (checkIn && !checkIn.value) {

    checkIn.value = today;
  }


  if (checkOut && !checkOut.value) {

    checkOut.value = tomorrow;
  }


  updateCalculatedRate();


  await loadReservations();


  await updateDashboard();


  setupRealtime();


  console.log(
    'Wild Hasthi POS ready.'
  );
}


// ============================================================
// REALTIME
// ============================================================

function setupRealtime() {

  if (realtimeStarted) {
    return;
  }


  if (!isSupabaseReady()) {
    return;
  }


  try {

    const supabase =
      getSupabase();


    supabase
      .channel(
        'wild-hasthi-live-updates'
      )

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        async function () {

          await loadReservations();

          await updateDashboard();
        }
      )

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_orders'
        },
        async function () {

          await updateDashboard();

          if (window.currentGuest) {
            await updateFolio();
          }
        }
      )

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'experiences'
        },
        async function () {

          await updateDashboard();

          if (window.currentGuest) {
            await updateFolio();
          }
        }
      )

      .subscribe(
        function (status) {

          console.log(
            'Realtime status:',
            status
          );
        }
      );


    realtimeStarted = true;

  }

  catch (error) {

    console.error(
      'Realtime setup error:',
      error
    );
  }
}


// ============================================================
// NAVIGATION
// ============================================================

function switchTab(tabName) {

  const views =
    document.querySelectorAll(
      '.tab-view'
    );


  views.forEach(
    function (view) {

      view.classList.add(
        'hidden'
      );

    }
  );


  const selectedView =
    document.getElementById(
      `view-${tabName}`
    );


  if (selectedView) {

    selectedView.classList.remove(
      'hidden'
    );
  }


  const buttons =
    document.querySelectorAll(
      '.nav-btn'
    );


  buttons.forEach(
    function (button) {

      button.classList.remove(
        'bg-slate-800',
        'text-white'
      );

      button.classList.add(
        'text-slate-400'
      );

    }
  );


  const selectedButton =
    document.getElementById(
      `nav-${tabName}`
    );


  if (selectedButton) {

    selectedButton.classList.add(
      'bg-slate-800',
      'text-white'
    );

    selectedButton.classList.remove(
      'text-slate-400'
    );
  }


  const titles = {

    dashboard: 'Dashboard',

    reservations: 'Bookings',

    pos: 'Restaurant POS',

    safari: 'Extra Experiences',

    folio: 'Guest Folio'

  };


  const pageTitle =
    document.getElementById(
      'pageTitle'
    );


  if (pageTitle) {

    pageTitle.textContent =
      titles[tabName] ||
      'Dashboard';
  }


  if (tabName === 'folio') {

    updateFolio();
  }


  if (tabName === 'reservations') {

    renderReservations();
  }
}


// ============================================================
// MODALS
// ============================================================

function openModal(id) {

  const modal =
    document.getElementById(id);


  if (modal) {

    modal.classList.remove(
      'hidden'
    );

    updateCalculatedRate();
  }
}


function closeModal(id) {

  const modal =
    document.getElementById(id);


  if (modal) {

    modal.classList.add(
      'hidden'
    );
  }
}


// ============================================================
// RATE CALCULATOR
// ============================================================

function updateCalculatedRate() {

  const selection =
    document.getElementById(
      'resSelection'
    );


  const packageSelect =
    document.getElementById(
      'resPackage'
    );


  const rateInput =
    document.getElementById(
      'resRate'
    );


  if (
    !selection ||
    !packageSelect ||
    !rateInput
  ) {

    return;
  }


  const occupancy =
    selection.value;


  const packageType =
    packageSelect.value;


  const row =
    RATE_MATRIX[occupancy];


  if (!row) {

    rateInput.value = '';

    return;
  }


  const rate =
    Number(
      row[packageType] || 0
    );


  rateInput.value = rate;
}


// ============================================================
// SAVE RESERVATION
// ============================================================

async function saveReservation(event) {

  if (event) {
    event.preventDefault();
  }


  if (!isSupabaseReady()) {

    alert(
      'Supabase is not initialized.'
    );

    return;
  }


  const guestName =
    document.getElementById(
      'resGuestName'
    )?.value.trim();


  const checkIn =
    document.getElementById(
      'resCheckIn'
    )?.value;


  const checkOut =
    document.getElementById(
      'resCheckOut'
    )?.value;


  const selection =
    document.getElementById(
      'resSelection'
    )?.value;


  const packageType =
    document.getElementById(
      'resPackage'
    )?.value;


  const safari =
    document.getElementById(
      'resSafari'
    )?.value;


  const rate =
    Number(
      document.getElementById(
        'resRate'
      )?.value || 0
    );


  if (
    !guestName ||
    !checkIn ||
    !checkOut ||
    !selection ||
    !packageType
  ) {

    alert(
      'Please complete all required reservation details.'
    );

    return;
  }


  if (checkOut <= checkIn) {

    alert(
      'Check-out date must be after check-in date.'
    );

    return;
  }


  try {

    const reservation = {
  guest_name: guestName,
  check_in: checkIn,
  check_out: checkOut,
  selection: selection,
  package_type: packageType,
  safari: safari,
  rate: rate,
  status: 'Confirmed'
};


    const supabase =
      getSupabase();


    const {
      data,
      error
    } =
      await supabase
        .from('reservations')
        .insert([
          reservation
        ])
        .select();


    if (error) {

      console.error(
        'Reservation save error:',
        error
      );

      alert(
        'Could not save booking.\n\n' +
        error.message
      );

      return;
    }


    console.log(
      'Reservation saved:',
      data
    );


    alert(
      'Reservation saved successfully.'
    );


    const form =
      document.getElementById(
        'reservationForm'
      );


    if (form) {
      form.reset();
    }


    const checkInInput =
      document.getElementById(
        'resCheckIn'
      );


    const checkOutInput =
      document.getElementById(
        'resCheckOut'
      );


    if (checkInInput) {
      checkInInput.value =
        getTodayString();
    }


    if (checkOutInput) {
      checkOutInput.value =
        getTomorrowString();
    }


    updateCalculatedRate();


    closeModal(
      'modalNewReservation'
    );


    await loadReservations();

    await updateDashboard();

  }

  catch (error) {

    console.error(
      'Unexpected reservation error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      (error.message || String(error))
    );
  }
}


// ============================================================
// LOAD RESERVATIONS
// ============================================================

async function loadReservations() {

  if (!isSupabaseReady()) {
    return;
  }


  try {

    const supabase =
      getSupabase();


    const {
      data,
      error
    } =
      await supabase
        .from('reservations')
        .select('*')
        .order(
          'check_in',
          {
            ascending: true
          }
        );


    if (error) {

      console.error(
        'Load reservations error:',
        error
      );


      const body =
        document.getElementById(
          'reservationsTableBody'
        );


      if (body) {

        body.innerHTML = `
          <tr>
            <td colspan="7"
                class="p-6 text-center text-rose-600 font-bold">
              Could not load reservations.
              <br>
              <span class="text-xs font-normal">
                ${escapeHtml(error.message)}
              </span>
            </td>
          </tr>
        `;
      }

      return;
    }


    window.reservations =
      Array.isArray(data)
        ? data
        : [];


    renderReservations();

  }

  catch (error) {

    console.error(
      'Unexpected load error:',
      error
    );
  }
}


// ============================================================
// RESERVATION STATUS HELPERS
// ============================================================

function getReservationStatus(reservation) {

  return String(
    reservation?.status ||
    'Confirmed'
  ).toLowerCase();
}


function isCancelled(reservation) {

  return [
    'cancelled',
    'canceled'
  ].includes(
    getReservationStatus(
      reservation
    )
  );
}


function isCheckedOut(reservation) {

  return [
    'checked-out',
    'checked_out',
    'checkedout'
  ].includes(
    getReservationStatus(
      reservation
    )
  );
}


function isInHouse(reservation) {

  const status =
    getReservationStatus(
      reservation
    );


  if (
    status === 'in-house' ||
    status === 'in_house' ||
    status === 'inhouse'
  ) {

    return true;
  }


  if (
    isCancelled(reservation) ||
    isCheckedOut(reservation)
  ) {

    return false;
  }


  const today =
    getTodayString();


  return (
    reservation.check_in <= today &&
    reservation.check_out > today
  );
}


function isFutureBooking(reservation) {

  if (
    isCancelled(reservation) ||
    isCheckedOut(reservation)
  ) {

    return false;
  }


  const today =
    getTodayString();


  return (
    reservation.check_in > today
  );
}


// ============================================================
// RESERVATION FILTER
// ============================================================

function filterReservations(filter) {

  currentFilter = filter;


  const filters = [
    'all',
    'in-house',
    'future',
    'checked-out',
    'cancelled'
  ];


  filters.forEach(
    function (name) {

      const button =
        document.getElementById(
          `filter-${name}`
        );


      if (!button) {
        return;
      }


      button.classList.remove(
        'bg-slate-900',
        'text-white'
      );


      button.classList.add(
        'bg-slate-100',
        'text-slate-700'
      );

    }
  );


  const active =
    document.getElementById(
      `filter-${filter}`
    );


  if (active) {

    active.classList.remove(
      'bg-slate-100',
      'text-slate-700'
    );


    active.classList.add(
      'bg-slate-900',
      'text-white'
    );
  }


  renderReservations();
}


// ============================================================
// RENDER RESERVATIONS
// ============================================================

function renderReservations() {

  const body =
    document.getElementById(
      'reservationsTableBody'
    );


  if (!body) {
    return;
  }


  let reservations =
    Array.isArray(
      window.reservations
    )
      ? [...window.reservations]
      : [];


  if (currentFilter === 'in-house') {

    reservations =
      reservations.filter(
        isInHouse
      );
  }


  if (currentFilter === 'future') {

    reservations =
      reservations.filter(
        isFutureBooking
      );
  }


  if (currentFilter === 'checked-out') {

    reservations =
      reservations.filter(
        isCheckedOut
      );
  }


  if (currentFilter === 'cancelled') {

    reservations =
      reservations.filter(
        isCancelled
      );
  }


  if (reservations.length === 0) {

    body.innerHTML = `
      <tr>
        <td colspan="7"
            class="p-8 text-center text-slate-400 italic">
          No bookings found.
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    reservations
      .map(
        renderReservationRow
      )
      .join('');
}


// ============================================================
// RESERVATION ROW
// ============================================================

function renderReservationRow(
  reservation
) {

  const status =
    getReservationStatus(
      reservation
    );


  let statusLabel =
    reservation.status ||
    'Confirmed';


  let statusClass =
    'bg-slate-100 text-slate-700';


  if (isCancelled(reservation)) {

    statusClass =
      'bg-rose-100 text-rose-700';

  }

  else if (isCheckedOut(reservation)) {

    statusClass =
      'bg-slate-200 text-slate-700';

  }

  else if (isInHouse(reservation)) {

    statusLabel =
      'In-House';

    statusClass =
      'bg-emerald-100 text-emerald-800';

  }

  else {

    statusClass =
      'bg-blue-100 text-blue-700';
  }


  const guestName =
    escapeHtml(
      reservation.guest_name ||
      reservation.name ||
      'Guest'
    );


  const occupancy =
    escapeHtml(
      reservation.occupancy ||
      reservation.selection ||
      '-'
    );


  const packageName =
    reservation.package ||
    reservation.board_basis ||
    '-';


  const rate =
    Number(
      reservation.rate ||
      reservation.amount ||
      0
    );


  let actions = '';


  if (
    !isCancelled(reservation) &&
    !isCheckedOut(reservation)
  ) {

    actions += `
      <button
        onclick="directCheckIn('${reservation.id}')"
        class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold mr-1">
        Check In
      </button>
    `;
  }


  if (isInHouse(reservation)) {

    actions += `
      <button
        onclick="selectGuestForFolio('${reservation.id}')"
        class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold mr-1">
        Folio
      </button>
    `;
  }


  if (isCheckedOut(reservation)) {

    actions += `
      <button
        onclick="reopenReservation('${reservation.id}')"
        class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold mr-1">
        Reopen
      </button>
    `;
  }


  if (!isCancelled(reservation)) {

    actions += `
      <button
        onclick="cancelBooking('${reservation.id}')"
        class="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-[10px] font-bold mr-1">
        Cancel
      </button>
    `;
  }


  actions += `
    <button
      onclick="deleteBooking('${reservation.id}')"
      class="px-2.5 py-1 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-lg text-[10px] font-bold">
      Delete
    </button>
  `;


  return `
    <tr class="hover:bg-slate-50">

      <td class="p-4 font-bold text-slate-800">
        ${guestName}
      </td>

      <td class="p-4 text-slate-500">
        ${formatDate(reservation.check_in)}
        →
        ${formatDate(reservation.check_out)}
      </td>

      <td class="p-4 text-slate-600">
        ${occupancy}
      </td>

      <td class="p-4 font-bold text-slate-600">
        ${escapeHtml(packageName)}
      </td>

      <td class="p-4 font-black text-emerald-700">
        ${formatMoney(rate)}
      </td>

      <td class="p-4">
        <span
          class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusClass}"
        >
          ${escapeHtml(statusLabel)}
        </span>
      </td>

      <td class="p-4 text-center whitespace-nowrap">
        ${actions}
      </td>

    </tr>
  `;
}


// ============================================================
// CHECK IN
// ============================================================

async function directCheckIn(id) {

  const reservation =
    window.reservations.find(
      function (item) {

        return String(item.id) ===
          String(id);

      }
    );


  if (!reservation) {

    alert(
      'Booking not found.'
    );

    return;
  }


  try {

    const supabase =
      getSupabase();


    const {
      error
    } =
      await supabase
        .from('reservations')
        .update({
          status: 'in-house'
        })
        .eq('id', id);


    if (error) {

      alert(
        'Could not check in guest.\n\n' +
        error.message
      );

      return;
    }


    window.currentGuest = {
      ...reservation,
      status: 'in-house'
    };


    alert(
      `${reservation.guest_name || 'Guest'} is now checked in.`
    );


    await loadReservations();

    await updateDashboard();


    switchTab(
      'folio'
    );

  }

  catch (error) {

    console.error(
      'Check-in error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// SELECT GUEST FOR FOLIO
// ============================================================

function selectGuestForFolio(id) {

  const reservation =
    window.reservations.find(
      function (item) {

        return String(item.id) ===
          String(id);

      }
    );


  if (!reservation) {

    alert(
      'Booking not found.'
    );

    return;
  }


  window.currentGuest =
    reservation;


  switchTab(
    'folio'
  );
}


// ============================================================
// REOPEN RESERVATION
// ============================================================

async function reopenReservation(id) {

  try {

    const supabase =
      getSupabase();


    const {
      error
    } =
      await supabase
        .from('reservations')
        .update({
          status: 'Confirmed'
        })
        .eq('id', id);


    if (error) {

      alert(
        'Could not reopen booking.\n\n' +
        error.message
      );

      return;
    }


    alert(
      'Booking reopened successfully.'
    );


    await loadReservations();

    await updateDashboard();

  }

  catch (error) {

    console.error(
      'Reopen error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// CANCEL BOOKING
// ============================================================

async function cancelBooking(id) {

  const confirmed =
    confirm(
      'Are you sure you want to cancel this booking?'
    );


  if (!confirmed) {
    return;
  }


  try {

    const supabase =
      getSupabase();


    const {
      error
    } =
      await supabase
        .from('reservations')
        .update({
          status: 'Cancelled'
        })
        .eq('id', id);


    if (error) {

      alert(
        'Could not cancel booking.\n\n' +
        error.message
      );

      return;
    }


    if (
      window.currentGuest &&
      String(window.currentGuest.id) ===
      String(id)
    ) {

      window.currentGuest = null;
    }


    alert(
      'Booking cancelled.'
    );


    await loadReservations();

    await updateDashboard();

  }

  catch (error) {

    console.error(
      'Cancel error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// DELETE BOOKING
// ============================================================

async function deleteBooking(id) {

  const confirmed =
    confirm(
      'Delete this booking permanently?\n\nThis cannot be undone.'
    );


  if (!confirmed) {
    return;
  }


  try {

    const supabase =
      getSupabase();


    const {
      error
    } =
      await supabase
        .from('reservations')
        .delete()
        .eq('id', id);


    if (error) {

      alert(
        'Could not delete booking.\n\n' +
        error.message
      );

      return;
    }


    if (
      window.currentGuest &&
      String(window.currentGuest.id) ===
      String(id)
    ) {

      window.currentGuest = null;
    }


    alert(
      'Booking deleted.'
    );


    await loadReservations();

    await updateDashboard();

  }

  catch (error) {

    console.error(
      'Delete error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// POS - ADD TO CART
// ============================================================

function addToCart(
  itemName,
  price
) {

  const existing =
    cart.find(
      function (item) {

        return item.name ===
          itemName;

      }
    );


  if (existing) {

    existing.quantity += 1;

  }

  else {

    cart.push({

      name: itemName,

      price: Number(price),

      quantity: 1

    });
  }


  renderCart();
}


// ============================================================
// POS - RENDER CART
// ============================================================

function renderCart() {

  const container =
    document.getElementById(
      'posCartItems'
    );


  const totalElement =
    document.getElementById(
      'posCartTotal'
    );


  if (!container) {
    return;
  }


  if (cart.length === 0) {

    container.innerHTML = `
      <p class="text-xs text-slate-400 italic text-center py-8">
        Cart is empty
      </p>
    `;


    if (totalElement) {

      totalElement.textContent =
        '$0.00';
    }


    return;
  }


  container.innerHTML =
    cart.map(
      function (item, index) {

        const lineTotal =
          item.price *
          item.quantity;


        return `
          <div
            class="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl"
          >

            <div class="min-w-0">

              <div class="text-xs font-bold text-slate-700 truncate">
                ${escapeHtml(item.name)}
              </div>

              <div class="text-[10px] text-slate-400">
                ${item.quantity} × ${formatMoney(item.price)}
              </div>

            </div>

            <div class="flex items-center gap-2">

              <span class="text-xs font-black text-emerald-700">
                ${formatMoney(lineTotal)}
              </span>

              <button
                onclick="removeFromCart(${index})"
                class="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200"
              >
                ×
              </button>

            </div>

          </div>
        `;
      }
    ).join('');


  const total =
    cart.reduce(
      function (sum, item) {

        return sum +
          item.price *
          item.quantity;

      },
      0
    );


  if (totalElement) {

    totalElement.textContent =
      formatMoney(total);
  }
}


// ============================================================
// POS - REMOVE CART ITEM
// ============================================================

function removeFromCart(index) {

  cart.splice(
    index,
    1
  );

  renderCart();
}


// ============================================================
// POS - CHECKOUT
// ============================================================

async function checkoutPos(payment_method) {

  if (cart.length === 0) {
    alert('Cart is empty.');
    return;
  }

  const total = cart.reduce(
    function (sum, item) {
      return sum + Number(item.price) * Number(item.quantity);
    },
    0
  );

  if (!isSupabaseReady()) {
    alert('Supabase is not connected.');
    return;
  }

  // Room charge requires an active guest
  if (payment_method === 'room') {

    if (!window.currentGuest) {
      alert(
        'Please select or check in a guest before charging to room.'
      );
      return;
    }

    if (!isPostingAllowed()) {
      alert(
        'The selected guest is not currently in-house.'
      );
      return;
    }
  }

  try {

    const supabase = getSupabase();

    // Check that the current login session exists
    const {
      data: sessionData,
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      alert(
        'Your login session has expired.\n\nPlease log in again.'
      );
      return;
    }

    const order = {
      items: cart,
      amount: total,
      date: getTodayString(),
      payment_method:
        payment_method === 'room'
          ? 'Room Charge'
          : 'Direct Pay'
    };

    console.log('Saving POS order:', order);

    /*
      IMPORTANT:
      We intentionally do NOT use .select() here.

      The database already accepts INSERT.
      Removing .select() prevents the POS payment
      from depending on a SELECT response after INSERT.
    */

    const {
      error
    } = await supabase
      .from('pos_orders')
      .insert([order]);

    if (error) {

      console.error(
        'POS order save error:',
        error
      );

      alert(
        'Could not save POS order.\n\n' +
        error.message
      );

      return;
    }

    console.log(
      'POS order saved successfully.'
    );

    alert(
      `POS payment recorded.\n\nTotal: ${formatMoney(total)}`
    );

    cart = [];

    renderCart();

    await updateDashboard();

    if (window.currentGuest) {
      await updateFolio();
    }

  } catch (error) {

    console.error(
      'POS error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      (error.message || String(error))
    );
  }
}

// ============================================================
// QUICK ADD EXPERIENCE
// ============================================================

async function quickAddExperience(
  name,
  price
) {

  if (!window.currentGuest) {

    alert(
      'Please check in or select an active guest first.'
    );

    switchTab(
      'reservations'
    );

    return;
  }


  if (!isPostingAllowed()) {

    alert(
      'Extra charges can only be posted to an active in-house guest.'
    );

    return;
  }


  try {

    const supabase =
      getSupabase();


    const experience = {

      reservation_id:
        window.currentGuest.id,

      experience_name:
        name,

      amount:
        Number(price)

    };


    const {
      error
    } =
      await supabase
        .from('experiences')
        .insert([
          experience
        ]);


    if (error) {

      alert(
        'Could not add extra charge.\n\n' +
        error.message
      );

      return;
    }


    alert(
      `${name} added to guest folio.\n\nAmount: ${formatMoney(price)}`
    );


    await updateDashboard();

    await updateFolio();

  }

  catch (error) {

    console.error(
      'Experience error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// POSTING CHECK
// ============================================================

function isPostingAllowed() {

  if (!window.currentGuest) {
    return false;
  }


  return isInHouse(
    window.currentGuest
  );
}


// ============================================================
// UPDATE FOLIO
// ============================================================

async function updateFolio() {

  if (!window.currentGuest) {

    setText(
      'folioAccomAmount',
      '$ 0.00'
    );

    setText(
      'folioPosAmount',
      '$ 0.00'
    );

    setText(
      'folioExpAmount',
      '$ 0.00'
    );

    setText(
      'folioTotalBill',
      '$ 0.00'
    );

    return;
  }


  const guest =
    window.currentGuest;


  const accommodation =
    Number(
      guest.rate ||
      guest.amount ||
      0
    );


  let posAmount = 0;
  let expAmount = 0;


  try {

    const supabase =
      getSupabase();


    const posResult =
      await supabase
        .from('pos_orders')
        .select('*');


    if (!posResult.error) {

      posAmount =
        (posResult.data || [])
          .filter(
            function (order) {

              return String(
                order.reservation_id
              ) === String(
                guest.id
              );

            }
          )
          .reduce(
            function (sum, order) {

              return sum +
                Number(
                  order.total || 0
                );

            },
            0
          );
    }


    const expResult =
      await supabase
        .from('experiences')
        .select('*');


    if (!expResult.error) {

      expAmount =
        (expResult.data || [])
          .filter(
            function (experience) {

              return String(
                experience.reservation_id
              ) === String(
                guest.id
              );

            }
          )
          .reduce(
            function (sum, experience) {

              return sum +
                Number(
                  experience.amount || 0
                );

            },
            0
          );
    }

  }

  catch (error) {

    console.error(
      'Folio load error:',
      error
    );
  }


  const total =
    accommodation +
    posAmount +
    expAmount;


  setText(
    'folioAccomAmount',
    formatMoney(accommodation)
  );


  setText(
    'folioPosAmount',
    formatMoney(posAmount)
  );


  setText(
    'folioExpAmount',
    formatMoney(expAmount)
  );


  setText(
    'folioTotalBill',
    formatMoney(total)
  );
}


// ============================================================
// FINAL CHECKOUT
// ============================================================

async function performFinalCheckout() {

  if (!window.currentGuest) {

    alert(
      'Please select an active guest first.'
    );

    switchTab(
      'reservations'
    );

    return;
  }


  const guest =
    window.currentGuest;


  const confirmed =
    confirm(
      `Check out ${guest.guest_name || 'guest'} and print the final bill?`
    );


  if (!confirmed) {
    return;
  }


  try {

    const supabase =
      getSupabase();


    const {
      error
    } =
      await supabase
        .from('reservations')
        .update({
          status: 'checked-out'
        })
        .eq('id', guest.id);


    if (error) {

      alert(
        'Could not check out guest.\n\n' +
        error.message
      );

      return;
    }


    await printFolioInvoice(
      guest
    );


    window.currentGuest =
      null;


    await loadReservations();

    await updateDashboard();

    updateFolio();

  }

  catch (error) {

    console.error(
      'Checkout error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// PRINT FOLIO INVOICE
// ============================================================

async function printFolioInvoice(
  reservationOverride = null
) {

  const guest =
    reservationOverride ||
    window.currentGuest;


  if (!guest) {

    alert(
      'Please select an active guest first.'
    );

    return;
  }


  let posAmount = 0;
  let expAmount = 0;

  let posRows = '';
  let expRows = '';


  try {

    const supabase =
      getSupabase();


    const posResult =
      await supabase
        .from('pos_orders')
        .select('*');


    if (!posResult.error) {

      const orders =
        (posResult.data || [])
          .filter(
            function (order) {

              return String(
                order.reservation_id
              ) === String(
                guest.id
              );

            }
          );


      orders.forEach(
        function (order) {

          const amount =
            Number(
              order.total || 0
            );


          posAmount += amount;


          let description =
            'Restaurant POS';


          if (
            Array.isArray(order.items) &&
            order.items.length
          ) {

            description =
              order.items
                .map(
                  function (item) {

                    return `${item.name} × ${item.quantity}`;

                  }
                )
                .join(', ');
          }


          posRows += `
            <tr>
              <td>
                ${escapeHtml(description)}
              </td>

              <td style="text-align:right;">
                ${formatMoney(amount)}
              </td>
            </tr>
          `;
        }
      );
    }


    const expResult =
      await supabase
        .from('experiences')
        .select('*');


    if (!expResult.error) {

      const experiences =
        (expResult.data || [])
          .filter(
            function (experience) {

              return String(
                experience.reservation_id
              ) === String(
                guest.id
              );

            }
          );


      experiences.forEach(
        function (experience) {

          const amount =
            Number(
              experience.amount || 0
            );


          expAmount += amount;


          expRows += `
            <tr>
              <td>
                ${escapeHtml(
                  experience.experience_name ||
                  'Extra Experience'
                )}
              </td>

              <td style="text-align:right;">
                ${formatMoney(amount)}
              </td>
            </tr>
          `;
        }
      );
    }

  }

  catch (error) {

    console.error(
      'Invoice data error:',
      error
    );
  }


  const accommodation =
    Number(
      guest.rate ||
      guest.amount ||
      0
    );


  const total =
    accommodation +
    posAmount +
    expAmount;


  const invoiceWindow =
    window.open(
      '',
      '_blank',
      'width=800,height=900'
    );


  if (!invoiceWindow) {

    alert(
      'Please allow pop-ups in your browser to print the invoice.'
    );

    return;
  }


  invoiceWindow.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <title>
        Wild Hasthi Guest Invoice
      </title>

      <style>

        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #1e293b;
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
        }

        h2 {
          margin: 5px 0;
          font-size: 15px;
          color: #64748b;
        }

        .guest {
          border: 1px solid #e2e8f0;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }

        th,
        td {
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }

        th {
          background: #f8fafc;
        }

        .total {
          font-size: 20px;
          font-weight: bold;
          text-align: right;
          margin-top: 25px;
        }

        .footer {
          text-align: center;
          margin-top: 50px;
          color: #64748b;
          font-size: 12px;
        }

      </style>

    </head>

    <body>

      <div class="header">

        <h1>
          WILD HASTHI
        </h1>

        <h2>
          Eco Resort & Safari Lodge
        </h2>

        <p>
          Guest Final Invoice
        </p>

      </div>


      <div class="guest">

        <strong>Guest:</strong>
        ${escapeHtml(
          guest.guest_name ||
          guest.name ||
          'Guest'
        )}

        <br>

        <strong>Check-In:</strong>
        ${formatDate(
          guest.check_in
        )}

        <br>

        <strong>Check-Out:</strong>
        ${formatDate(
          guest.check_out
        )}

        <br>

        <strong>Occupancy:</strong>
        ${escapeHtml(
          guest.occupancy ||
          '-'
        )}

        <br>

        <strong>Package:</strong>
        ${escapeHtml(
          guest.package ||
          '-'
        )}

      </div>


      <h3>
        Accommodation
      </h3>

      <table>

        <tr>

          <td>
            Accommodation Package
          </td>

          <td style="text-align:right;">
            ${formatMoney(
              accommodation
            )}
          </td>

        </tr>

      </table>


      <h3>
        Restaurant / POS
      </h3>

      <table>

        ${
          posRows ||
          `
            <tr>
              <td>
                No POS charges
              </td>

              <td style="text-align:right;">
                ${formatMoney(0)}
              </td>
            </tr>
          `
        }

      </table>


      <h3>
        Extra Experiences
      </h3>

      <table>

        ${
          expRows ||
          `
            <tr>
              <td>
                No extra experiences
              </td>

              <td style="text-align:right;">
                ${formatMoney(0)}
              </td>
            </tr>
          `
        }

      </table>


      <div class="total">

        TOTAL:
        ${formatMoney(total)}

      </div>


      <div class="footer">

        Thank you for staying with Wild Hasthi.

        <br>

        We hope to welcome you again.

      </div>

    </body>

    </html>
  `);


  invoiceWindow.document.close();

  invoiceWindow.focus();


  setTimeout(
    function () {

      invoiceWindow.print();

    },
    500
  );
}


// ============================================================
// DAILY REVENUE REPORT
// ============================================================

async function printDailyRevenueReport() {

  const today =
    getTodayString();


  let roomRevenue = 0;
  let posRevenue = 0;
  let expRevenue = 0;


  try {

    const supabase =
      getSupabase();


    const reservationsResult =
      await supabase
        .from('reservations')
        .select('*');


    if (!reservationsResult.error) {

      roomRevenue =
        (reservationsResult.data || [])
          .filter(
            function (reservation) {

              return (
                reservation.check_in === today &&
                !isCancelled(
                  reservation
                )
              );

            }
          )
          .reduce(
            function (sum, reservation) {

              return sum +
                Number(
                  reservation.rate || 0
                );

            },
            0
          );
    }


    const posResult =
      await supabase
        .from('pos_orders')
        .select('*');


    if (!posResult.error) {

      posRevenue =
        (posResult.data || [])
          .filter(
            function (order) {

              const created =
                order.created_at ||
                order.createdAt;

              return created &&
                String(
                  created
                ).slice(0, 10) === today;

            }
          )
          .reduce(
            function (sum, order) {

              return sum +
                Number(
                  order.total || 0
                );

            },
            0
          );
    }


    const expResult =
      await supabase
        .from('experiences')
        .select('*');


    if (!expResult.error) {

      expRevenue =
        (expResult.data || [])
          .filter(
            function (experience) {

              const created =
                experience.created_at ||
                experience.createdAt;

              return created &&
                String(
                  created
                ).slice(0, 10) === today;

            }
          )
          .reduce(
            function (sum, experience) {

              return sum +
                Number(
                  experience.amount || 0
                );

            },
            0
          );
    }

  }

  catch (error) {

    console.error(
      'Daily report error:',
      error
    );
  }


  printRevenueReport(
    'Daily Revenue Report',
    today,
    roomRevenue,
    posRevenue,
    expRevenue
  );
}


// ============================================================
// MONTHLY REVENUE REPORT
// ============================================================

async function printMonthlyRevenueReport() {

  const month =
    getCurrentMonthString();


  let roomRevenue = 0;
  let posRevenue = 0;
  let expRevenue = 0;


  try {

    const supabase =
      getSupabase();


    const reservationsResult =
      await supabase
        .from('reservations')
        .select('*');


    if (!reservationsResult.error) {

      roomRevenue =
        (reservationsResult.data || [])
          .filter(
            function (reservation) {

              return (
                String(
                  reservation.check_in || ''
                ).slice(0, 7) === month &&
                !isCancelled(
                  reservation
                )
              );

            }
          )
          .reduce(
            function (sum, reservation) {

              return sum +
                Number(
                  reservation.rate || 0
                );

            },
            0
          );
    }


    const posResult =
      await supabase
        .from('pos_orders')
        .select('*');


    if (!posResult.error) {

      posRevenue =
        (posResult.data || [])
          .filter(
            function (order) {

              const created =
                order.created_at ||
                order.createdAt;

              return created &&
                String(
                  created
                ).slice(0, 7) === month;

            }
          )
          .reduce(
            function (sum, order) {

              return sum +
                Number(
                  order.total || 0
                );

            },
            0
          );
    }


    const expResult =
      await supabase
        .from('experiences')
        .select('*');


    if (!expResult.error) {

      expRevenue =
        (expResult.data || [])
          .filter(
            function (experience) {

              const created =
                experience.created_at ||
                experience.createdAt;

              return created &&
                String(
                  created
                ).slice(0, 7) === month;

            }
          )
          .reduce(
            function (sum, experience) {

              return sum +
                Number(
                  experience.amount || 0
                );

            },
            0
          );
    }

  }

  catch (error) {

    console.error(
      'Monthly report error:',
      error
    );
  }


  printRevenueReport(
    'Monthly Revenue Report',
    month,
    roomRevenue,
    posRevenue,
    expRevenue
  );
}


// ============================================================
// GENERIC REVENUE PRINT
// ============================================================

function printRevenueReport(
  title,
  period,
  room,
  pos,
  exp
) {

  const total =
    Number(room) +
    Number(pos) +
    Number(exp);


  const reportWindow =
    window.open(
      '',
      '_blank',
      'width=800,height=800'
    );


  if (!reportWindow) {

    alert(
      'Please allow pop-ups in your browser.'
    );

    return;
  }


  reportWindow.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <title>
        ${escapeHtml(title)}
      </title>

      <style>

        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #1e293b;
        }

        h1 {
          margin-bottom: 5px;
        }

        .period {
          color: #64748b;
          margin-bottom: 30px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        td {
          padding: 15px;
          border-bottom: 1px solid #e2e8f0;
        }

        .total {
          font-size: 22px;
          font-weight: bold;
          margin-top: 25px;
          text-align: right;
        }

        .footer {
          margin-top: 50px;
          color: #64748b;
          font-size: 12px;
          text-align: center;
        }

      </style>

    </head>

    <body>

      <h1>
        WILD HASTHI
      </h1>

      <h2>
        ${escapeHtml(title)}
      </h2>

      <div class="period">
        Period: ${escapeHtml(period)}
      </div>


      <table>

        <tr>

          <td>
            Room Packages
          </td>

          <td style="text-align:right;">
            ${formatMoney(room)}
          </td>

        </tr>


        <tr>

          <td>
            Restaurant / POS
          </td>

          <td style="text-align:right;">
            ${formatMoney(pos)}
          </td>

        </tr>


        <tr>

          <td>
            Extra Experiences
          </td>

          <td style="text-align:right;">
            ${formatMoney(exp)}
          </td>

        </tr>

      </table>


      <div class="total">

        Total Revenue:
        ${formatMoney(total)}

      </div>


      <div class="footer">

        Wild Hasthi Eco Resort & Safari Lodge

      </div>

    </body>

    </html>
  `);


  reportWindow.document.close();

  reportWindow.focus();


  setTimeout(
    function () {

      reportWindow.print();

    },
    500
  );
}


// ============================================================
// DASHBOARD
// ============================================================

async function updateDashboard() {

  if (!isSupabaseReady()) {
    return;
  }


  const reservations =
    Array.isArray(
      window.reservations
    )
      ? window.reservations
      : [];


  const today =
    getTodayString();


  const month =
    getCurrentMonthString();


  const activeReservations =
    reservations.filter(
      function (reservation) {

        return !isCancelled(
          reservation
        );

      }
    );


  const inHouse =
    activeReservations.filter(
      isInHouse
    );


  const future =
    activeReservations.filter(
      isFutureBooking
    );


  const arrivals =
    activeReservations.filter(
      function (reservation) {

        return (
          reservation.check_in === today &&
          !isCheckedOut(
            reservation
          )
        );

      }
    );


  setText(
    'statInHouse',
    inHouse.length
  );


  setText(
    'statFuture',
    future.length
  );


  setText(
    'statArrivals',
    arrivals.length
  );


  let todayRoom = 0;
  let monthRoom = 0;

  let todayPos = 0;
  let monthPos = 0;

  let todayExp = 0;
  let monthExp = 0;


  activeReservations.forEach(
    function (reservation) {

      const rate =
        Number(
          reservation.rate || 0
        );


      if (
        reservation.check_in === today
      ) {

        todayRoom += rate;
      }


      if (
        String(
          reservation.check_in || ''
        ).slice(0, 7) === month
      ) {

        monthRoom += rate;
      }

    }
  );


  try {

    const supabase =
      getSupabase();


    const {
      data: orders,
      error: posError
    } =
      await supabase
        .from('pos_orders')
        .select('*');


    if (!posError) {

      (orders || []).forEach(
        function (order) {

          const created =
            order.created_at ||
            order.createdAt;


          if (!created) {
            return;
          }


          const date =
            String(
              created
            ).slice(0, 10);


          const orderMonth =
            String(
              created
            ).slice(0, 7);


          const amount =
            Number(
              order.total || 0
            );


          if (
            date === today
          ) {

            todayPos += amount;
          }


          if (
            orderMonth === month
          ) {

            monthPos += amount;
          }

        }
      );
    }


    const {
      data: experiences,
      error: expError
    } =
      await supabase
        .from('experiences')
        .select('*');


    if (!expError) {

      (experiences || []).forEach(
        function (experience) {

          const created =
            experience.created_at ||
            experience.createdAt;


          if (!created) {
            return;
          }


          const date =
            String(
              created
            ).slice(0, 10);


          const experienceMonth =
            String(
              created
            ).slice(0, 7);


          const amount =
            Number(
              experience.amount || 0
            );


          if (
            date === today
          ) {

            todayExp += amount;
          }


          if (
            experienceMonth === month
          ) {

            monthExp += amount;
          }

        }
      );
    }

  }

  catch (error) {

    console.error(
      'Dashboard revenue error:',
      error
    );
  }


  const todayTotal =
    todayRoom +
    todayPos +
    todayExp;


  const monthTotal =
    monthRoom +
    monthPos +
    monthExp;


  setText(
    'statDailyRevenue',
    formatMoney(todayTotal)
  );


  setText(
    'statMonthlyRevenue',
    formatMoney(monthTotal)
  );


  setText(
    'dashTodayRoom',
    formatMoney(todayRoom)
  );


  setText(
    'dashTodayPos',
    formatMoney(todayPos)
  );


  setText(
    'dashTodayExp',
    formatMoney(todayExp)
  );


  setText(
    'dashTodayTotal',
    formatMoney(todayTotal)
  );


  setText(
    'dashMonthRoom',
    formatMoney(monthRoom)
  );


  setText(
    'dashMonthPos',
    formatMoney(monthPos)
  );


  setText(
    'dashMonthExp',
    formatMoney(monthExp)
  );


  setText(
    'dashMonthTotal',
    formatMoney(monthTotal)
  );


  updateCabinStatus(
    inHouse
  );
}


// ============================================================
// CABIN STATUS
// ============================================================

function updateCabinStatus(
  inHouse
) {

  const badge =
    document.getElementById(
      'cabinStatusBadge'
    );


  const housekeeping =
    document.getElementById(
      'housekeepingBadge'
    );


  if (!badge) {
    return;
  }


  if (inHouse.length > 0) {

    badge.textContent =
      'OCCUPIED';


    badge.className =
      'px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold';


    if (housekeeping) {

      housekeeping.textContent =
        'IN SERVICE';


      housekeeping.className =
        'py-1 px-3 bg-blue-100 text-blue-800 rounded-xl font-bold';
    }

  }

  else {

    badge.textContent =
      'VACANT';


    badge.className =
      'px-3 py-1 bg-slate-400 text-white rounded-full text-xs font-bold';


    if (housekeeping) {

      housekeeping.textContent =
        'CLEAN / READY';


      housekeeping.className =
        'py-1 px-3 bg-emerald-100 text-emerald-800 rounded-xl font-bold';
    }
  }
}


// ============================================================
// CLEAR ALL DATA
// ============================================================

async function clearAllData() {

  const confirmed =
    confirm(
      'WARNING!\n\nThis will permanently delete ALL reservations, POS orders and extra experiences.\n\nContinue?'
    );


  if (!confirmed) {
    return;
  }


  const secondConfirm =
    confirm(
      'FINAL WARNING!\n\nAll history and revenue data will be permanently deleted.'
    );


  if (!secondConfirm) {
    return;
  }


  try {

    const supabase =
      getSupabase();


    const tables = [
      'reservations',
      'pos_orders',
      'experiences'
    ];


    for (
      const table of tables
    ) {

      const {
        error
      } =
        await supabase
          .from(table)
          .delete()
          .neq(
            'id',
            -1
          );


      if (error) {

        console.error(
          `Clear ${table} error:`,
          error
        );

        alert(
          `Could not clear ${table}.\n\n${error.message}`
        );

        return;
      }
    }


    window.currentGuest =
      null;

    window.reservations =
      [];

    cart = [];


    renderCart();

    renderReservations();

    updateFolio();

    await updateDashboard();


    alert(
      'All history and revenue data has been cleared.'
    );

  }

  catch (error) {

    console.error(
      'Clear all error:',
      error
    );

    alert(
      'Unexpected error:\n\n' +
      error.message
    );
  }
}


// ============================================================
// HELPER - SET TEXT
// ============================================================

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;
  }
}


// ============================================================
// HELPER - ESCAPE HTML
// ============================================================

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';
  }


  return String(value)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


// ============================================================
// EXPOSE FUNCTIONS FOR HTML ONCLICK
// ============================================================

window.handleLogin =
  handleLogin;

window.logout =
  logout;

window.switchTab =
  switchTab;

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.saveReservation =
  saveReservation;

window.updateCalculatedRate =
  updateCalculatedRate;

window.filterReservations =
  filterReservations;

window.directCheckIn =
  directCheckIn;

window.selectGuestForFolio =
  selectGuestForFolio;

window.reopenReservation =
  reopenReservation;

window.cancelBooking =
  cancelBooking;

window.deleteBooking =
  deleteBooking;

window.addToCart =
  addToCart;

window.removeFromCart =
  removeFromCart;

window.checkoutPos =
  checkoutPos;

window.quickAddExperience =
  quickAddExperience;

window.performFinalCheckout =
  performFinalCheckout;

window.printFolioInvoice =
  printFolioInvoice;

window.printDailyRevenueReport =
  printDailyRevenueReport;

window.printMonthlyRevenueReport =
  printMonthlyRevenueReport;

window.clearAllData =
  clearAllData;


// ============================================================
// END OF WILD HASTHI POS
// ============================================================
