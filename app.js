// ============================================================
// WILD HASTHI POS
// SUPABASE CLOUD DATABASE VERSION
// ============================================================

// Supabase client is created in index.html
// const supabase = window.supabase.createClient(...);


// ============================================================
// RATE MATRIX
// ============================================================

const RATE_MATRIX = {
  '1 adult': { HB: 330, AI: 430 },
  '2 adults': { HB: 330, AI: 430 },
  '3 adults': { HB: 405, AI: 530 },
  '2 adults + 1 child 6-11': { HB: 370, AI: 485 },
  '2 adults + 2 children 6-11': { HB: 410, AI: 540 }
};

let currentFilter = 'all';
let cart = [];

window.currentGuest = null;
window.reservations = [];


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

function getCurrentMonthString() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}


// ============================================================
// LOGIN / LOGOUT
// ============================================================

function showLoginScreen() {
  const overlay = document.getElementById('loginOverlay');

  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
  }
}

function hideLoginScreen() {
  const overlay = document.getElementById('loginOverlay');

  if (overlay) {
    overlay.style.setProperty('display', 'none', 'important');
    overlay.classList.add('hidden');
  }
}


// Supabase login
async function handleLogin(event) {
  if (event) event.preventDefault();

  const emailEl = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('pinInput');

  const email = emailEl ? emailEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';

  if (!email || !password) {
    alert('Please enter your email address and password.');
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error(error);
      alert('Login failed: ' + error.message);
      return;
    }

    if (!data.session) {
      alert('Login failed. No active session was created.');
      return;
    }

    hideLoginScreen();

    await initApp();

  } catch (error) {
    console.error('Login error:', error);
    alert('Could not connect to the cloud database.');
  }
}

window.handleLogin = handleLogin;


// Logout
async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Logout error:', error);
  }

  window.currentGuest = null;

  showLoginScreen();
}

window.logout = logout;


// ============================================================
// AUTH CHECK
// ============================================================

async function checkAuthentication() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Session error:', error);
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


// ============================================================
// APP INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const loggedIn = await checkAuthentication();

  if (loggedIn) {
    await initApp();
  }

});


async function initApp() {

  hideLoginScreen();

  const today = new Date();

  const options = {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  };

  const dateStr = today
    .toLocaleDateString('en-GB', options)
    .toUpperCase();

  const dateEl = document.getElementById('currentDateDisplay');

  if (dateEl) {
    dateEl.innerText = dateStr;
  }


  const todayStr = getTodayString();

  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');

  const tomorrowStr = `${year}-${month}-${day}`;


  const checkInInput = document.getElementById('resCheckIn');
  const checkOutInput = document.getElementById('resCheckOut');

  if (checkInInput) {
    checkInInput.value = todayStr;
  }

  if (checkOutInput) {
    checkOutInput.value = tomorrowStr;
  }


  updateCalculatedRate();

  await loadReservations();

  await updateDashboard();

  setupRealtime();
}


// ============================================================
// REALTIME SYNC
// ============================================================

let realtimeStarted = false;

function setupRealtime() {

  if (realtimeStarted) return;

  realtimeStarted = true;

  supabase
    .channel('wild-hasthi-pos-live-sync')

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations'
      },
      async () => {

        console.log('Reservation changed');

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
      async () => {

        console.log('POS order changed');

        await updateDashboard();
      }
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'experiences'
      },
      async () => {

        console.log('Experience changed');

        await updateDashboard();
      }
    )

    .subscribe();
}


// ============================================================
// NAVIGATION
// ============================================================

function switchTab(tabId) {

  document
    .querySelectorAll('.tab-view')
    .forEach(view => view.classList.add('hidden'));

  document
    .querySelectorAll('.nav-btn')
    .forEach(btn => {

      btn.classList.remove(
        'active-nav',
        'bg-slate-800',
        'text-white'
      );

      btn.classList.add('text-slate-400');

    });


  const activeView = document.getElementById(`view-${tabId}`);

  if (activeView) {
    activeView.classList.remove('hidden');
  }


  const activeNav = document.getElementById(`nav-${tabId}`);

  if (activeNav) {

    activeNav.classList.add(
      'active-nav',
      'bg-slate-800',
      'text-white'
    );

    activeNav.classList.remove('text-slate-400');
  }


  const titleMap = {

    dashboard: 'Dashboard',

    reservations: 'Reservations & Future Bookings',

    pos: 'Restaurant & POS',

    safari: 'Tours & Experiences',

    folio: 'Guest Folio'

  };


  const titleEl = document.getElementById('pageTitle');

  if (titleEl) {
    titleEl.innerText =
      titleMap[tabId] || 'Dashboard';
  }

}

window.switchTab = switchTab;


// ============================================================
// MODALS
// ============================================================

function openModal(modalId) {

  const modal = document.getElementById(modalId);

  if (modal) {
    modal.classList.remove('hidden');
  }

}

window.openModal = openModal;


function closeModal(modalId) {

  const modal = document.getElementById(modalId);

  if (modal) {
    modal.classList.add('hidden');
  }

}

window.closeModal = closeModal;


// ============================================================
// RATE CALCULATOR
// ============================================================

function updateCalculatedRate() {

  const selectionEl =
    document.getElementById('resSelection');

  const packageEl =
    document.getElementById('resPackage');

  const rateInput =
    document.getElementById('resRate');


  if (!selectionEl || !packageEl || !rateInput) {
    return;
  }


  const selection = selectionEl.value;

  const boardBasis = packageEl.value;


  if (
    RATE_MATRIX[selection] &&
    RATE_MATRIX[selection][boardBasis]
  ) {

    rateInput.value =
      RATE_MATRIX[selection][boardBasis];

  }

}

window.updateCalculatedRate = updateCalculatedRate;


// ============================================================
// RESERVATIONS
// ============================================================

async function saveReservation(event) {

  event.preventDefault();


  const reservation = {

    guest_name:
      document.getElementById('resGuestName').value,

    check_in:
      document.getElementById('resCheckIn').value,

    check_out:
      document.getElementById('resCheckOut').value,

    selection:
      document.getElementById('resSelection').value,

    package_type:
      document.getElementById('resPackage').value,

    safari:
      document.getElementById('resSafari').value,

    rate:
      parseFloat(
        document.getElementById('resRate').value
      ),

    status:
      'Confirmed'
  };


  try {

    const { error } =
      await supabase
        .from('reservations')
        .insert(reservation);


    if (error) {
      console.error(error);
      alert('Could not save reservation: ' + error.message);
      return;
    }


    closeModal('modalNewReservation');

    document
      .getElementById('reservationForm')
      .reset();


    const todayStr = getTodayString();

    const tomorrow = new Date();

    tomorrow.setDate(tomorrow.getDate() + 1);

    const year = tomorrow.getFullYear();

    const month =
      String(tomorrow.getMonth() + 1)
        .padStart(2, '0');

    const day =
      String(tomorrow.getDate())
        .padStart(2, '0');


    document.getElementById('resCheckIn').value =
      todayStr;

    document.getElementById('resCheckOut').value =
      `${year}-${month}-${day}`;


    updateCalculatedRate();

    await loadReservations();

    await updateDashboard();


    alert('Reservation saved successfully!');

  } catch (error) {

    console.error(error);

    alert('Could not save reservation.');

  }

}

window.saveReservation = saveReservation;


// ============================================================
// LOAD RESERVATIONS
// ============================================================

async function loadReservations() {

  try {

    const { data, error } =
      await supabase
        .from('reservations')
        .select('*')
        .order('id', {
          ascending: false
        });


    if (error) {
      console.error(error);
      alert('Could not load reservations: ' + error.message);
      return;
    }


    let reservations =
      (data || []).map(mapReservationFromSupabase);


    window.reservations = reservations;


    if (currentFilter === 'in-house') {

      reservations =
        reservations.filter(r =>
          r.status === 'Checked In' ||
          r.status === 'in-house'
        );

    }

    else if (currentFilter === 'future') {

      reservations =
        reservations.filter(r =>
          r.status === 'Confirmed' ||
          r.status === 'future'
        );

    }

    else if (currentFilter === 'checked-out') {

      reservations =
        reservations.filter(r =>
          r.status === 'Checked Out' ||
          r.status === 'checked-out'
        );

    }

    else if (currentFilter === 'cancelled') {

      reservations =
        reservations.filter(r =>
          r.status === 'cancelled' ||
          r.status === 'Cancelled'
        );

    }


    const tbody =
      document.getElementById(
        'reservationsTableBody'
      );


    if (!tbody) return;


    tbody.innerHTML = '';


    if (reservations.length === 0) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7"
              class="p-4 text-center text-slate-400 italic">
            No bookings found in this category.
          </td>
        </tr>
      `;

      return;
    }


    reservations.forEach(res => {

      tbody.innerHTML +=
        renderReservationRow(res);

    });


  } catch (error) {

    console.error('Load reservations error:', error);

  }

}

window.loadReservations = loadReservations;


// ============================================================
// SUPABASE → APP MAPPING
// ============================================================

function mapReservationFromSupabase(row) {

  return {

    id: row.id,

    guestName: row.guest_name,

    checkIn: row.check_in,

    checkOut: row.check_out,

    selection: row.selection,

    packageType: row.package_type,

    package: row.package_type,

    safari: row.safari,

    rate: Number(row.rate || 0),

    status: row.status,

    createdAt: row.created_at

  };

}


function mapPosOrderFromSupabase(row) {

  return {

    id: row.id,

    items: row.items || [],

    amount: Number(row.amount || 0),

    date: row.date,

    paymentMethod: row.payment_method,

    createdAt: row.created_at

  };

}


function mapExperienceFromSupabase(row) {

  return {

    id: row.id,

    name: row.name,

    amount: Number(row.amount || 0),

    date: row.date,

    createdAt: row.created_at

  };

}


// ============================================================
// RESERVATION FILTER
// ============================================================

function filterReservations(filterType) {

  currentFilter = filterType;


  [
    'all',
    'in-house',
    'future',
    'checked-out',
    'cancelled'
  ].forEach(f => {

    const btn =
      document.getElementById(`filter-${f}`);


    if (!btn) return;


    if (f === filterType) {

      btn.className =
        'px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold transition';

    } else {

      btn.className =
        'px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition';

    }

  });


  loadReservations();

}

window.filterReservations = filterReservations;


// ============================================================
// CHECK IN
// ============================================================

async function checkInGuest(id) {

  if (!confirm(
    'Check in guest now? This will activate the room.'
  )) {
    return;
  }


  const { error } =
    await supabase
      .from('reservations')
      .update({
        status: 'in-house'
      })
      .eq('id', Number(id));


  if (error) {

    console.error(error);

    alert(
      'Could not check in guest: ' +
      error.message
    );

    return;
  }


  const { data: guest } =
    await supabase
      .from('reservations')
      .select('*')
      .eq('id', Number(id))
      .single();


  if (guest) {

    window.currentGuest =
      mapReservationFromSupabase(guest);

  }


  await loadReservations();

  await updateDashboard();

}

window.checkInGuest = checkInGuest;


// ============================================================
// DIRECT CHECKOUT
// ============================================================

async function checkoutGuestDirect(id) {

  if (!confirm(
    'Check out this guest now?'
  )) {
    return;
  }


  const { error } =
    await supabase
      .from('reservations')
      .update({
        status: 'checked-out'
      })
      .eq('id', Number(id));


  if (error) {

    console.error(error);

    alert(
      'Could not check out guest: ' +
      error.message
    );

    return;
  }


  if (
    window.currentGuest &&
    window.currentGuest.id === Number(id)
  ) {

    window.currentGuest = null;

  }


  await loadReservations();

  await updateDashboard();

}

window.checkoutGuestDirect =
  checkoutGuestDirect;


// ============================================================
// REOPEN BOOKING
// ============================================================

async function reopenBooking(id) {

  if (!confirm(
    'Re-open this booking back to Confirmed status?'
  )) {
    return;
  }


  const { error } =
    await supabase
      .from('reservations')
      .update({
        status: 'Confirmed'
      })
      .eq('id', Number(id));


  if (error) {

    console.error(error);

    alert(
      'Could not reopen booking: ' +
      error.message
    );

    return;
  }


  await loadReservations();

  await updateDashboard();

}

window.reopenBooking = reopenBooking;


// ============================================================
// POS CART
// ============================================================

function addToCart(name, price) {

  const existing =
    cart.find(item => item.name === name);


  if (existing) {

    existing.qty += 1;

  } else {

    cart.push({

      name: name,

      price: Number(price),

      qty: 1

    });

  }


  renderCart();

}

window.addToCart = addToCart;


// ============================================================
// RENDER CART
// ============================================================

function renderCart() {

  const container =
    document.getElementById('posCartItems');

  const totalEl =
    document.getElementById('posCartTotal');


  if (!container || !totalEl) return;


  if (cart.length === 0) {

    container.innerHTML = `
      <p class="text-xs text-slate-400 italic text-center py-8">
        Cart is empty
      </p>
    `;

    totalEl.innerText = '$0';

    return;

  }


  let total = 0;


  container.innerHTML =
    cart.map((item, index) => {

      const itemTotal =
        item.price * item.qty;

      total += itemTotal;


      return `
        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl text-sm">

          <div>

            <div class="font-bold text-slate-800">
              ${item.name}
            </div>

            <div class="text-xs text-slate-400">
              $${item.price} x ${item.qty}
            </div>

          </div>

          <div class="flex items-center gap-2">

            <span class="font-bold text-slate-900">
              $${itemTotal}
            </span>

            <button
              onclick="removeFromCart(${index})"
              class="text-rose-500 hover:text-rose-700 text-xs px-1">

              <i class="fa-solid fa-trash"></i>

            </button>

          </div>

        </div>
      `;

    }).join('');


  totalEl.innerText =
    `$${total}`;

}

window.renderCart = renderCart;


// ============================================================
// REMOVE CART ITEM
// ============================================================

function removeFromCart(index) {

  cart.splice(index, 1);

  renderCart();

}

window.removeFromCart = removeFromCart;


// ============================================================
// CLEAR ALL DATA
// ============================================================

async function clearAllData() {

  if (!confirm(
    'Are you sure you want to clear ALL history? This will delete bookings, restaurant orders, and extra experiences.'
  )) {
    return;
  }


  try {

    const reservationDelete =
      await supabase
        .from('reservations')
        .delete()
        .neq('id', -1);


    if (reservationDelete.error) {
      throw reservationDelete.error;
    }


    const posDelete =
      await supabase
        .from('pos_orders')
        .delete()
        .neq('id', -1);


    if (posDelete.error) {
      throw posDelete.error;
    }


    const experienceDelete =
      await supabase
        .from('experiences')
        .delete()
        .neq('id', -1);


    if (experienceDelete.error) {
      throw experienceDelete.error;
    }


    window.currentGuest = null;


    await loadReservations();

    await updateDashboard();


    alert(
      'All data cleared successfully!'
    );


  } catch (error) {

    console.error(
      'Clear all data error:',
      error
    );

    alert(
      'Could not clear all data: ' +
      error.message
    );

  }

}

window.clearAllData = clearAllData;


// ============================================================
// DASHBOARD
// ============================================================

async function updateDashboard() {

  try {

    const todayStr =
      getTodayString();

    const currentMonthStr =
      getCurrentMonthString();


    const [
      reservationsResult,
      posResult,
      experiencesResult
    ] = await Promise.all([

      supabase
        .from('reservations')
        .select('*'),

      supabase
        .from('pos_orders')
        .select('*'),

      supabase
        .from('experiences')
        .select('*')

    ]);


    if (reservationsResult.error) {
      throw reservationsResult.error;
    }

    if (posResult.error) {
      throw posResult.error;
    }

    if (experiencesResult.error) {
      throw experiencesResult.error;
    }


    const reservations =
      (reservationsResult.data || [])
        .map(mapReservationFromSupabase);


    const posOrders =
      (posResult.data || [])
        .map(mapPosOrderFromSupabase);


    const experiences =
      (experiencesResult.data || [])
        .map(mapExperienceFromSupabase);


    const inHouseGuests =
      reservations.filter(r =>
        r.status === 'Checked In' ||
        r.status === 'in-house'
      );


    const futureBookings =
      reservations.filter(r =>
        r.status === 'Confirmed' ||
        r.status === 'future'
      );


    const arrivalsToday =
      reservations.filter(r =>
        r.checkIn === todayStr
      );


    if (inHouseGuests.length > 0) {

      window.currentGuest =
        inHouseGuests[
          inHouseGuests.length - 1
        ];

    } else {

      window.currentGuest = null;

    }


    const todayRoomRev =
      reservations

        .filter(r =>
          (
            r.status === 'Checked In' ||
            r.status === 'in-house'
          )
          ||
          (
            r.checkIn === todayStr &&
            (
              r.status === 'Checked Out' ||
              r.status === 'checked-out'
            )
          )
        )

        .reduce(
          (sum, r) =>
            sum + Number(r.rate || 0),
          0
        );


    const todayPosRev =
      posOrders

        .filter(o =>
          o.date === todayStr
        )

        .reduce(
          (sum, o) =>
            sum + Number(o.amount || 0),
          0
        );


    const todayExpRev =
      experiences

        .filter(e =>
          e.date === todayStr
        )

        .reduce(
          (sum, e) =>
            sum + Number(e.amount || 0),
          0
        );


    const dailyTotalRev =
      todayRoomRev +
      todayPosRev +
      todayExpRev;


    const monthRoomRev =
      reservations

        .filter(r =>
          r.status !== 'cancelled' &&
          r.status !== 'Cancelled'
        )

        .reduce(
          (sum, r) =>
            sum + Number(r.rate || 0),
          0
        );


    const monthPosRev =
      posOrders

        .filter(o =>
          o.date &&
          o.date.startsWith(
            currentMonthStr
          )
        )

        .reduce(
          (sum, o) =>
            sum + Number(o.amount || 0),
          0
        );


    const monthExpRev =
      experiences

        .filter(e =>
          e.date &&
          e.date.startsWith(
            currentMonthStr
          )
        )

        .reduce(
          (sum, e) =>
            sum + Number(e.amount || 0),
          0
        );


    const monthlyTotalRev =
      monthRoomRev +
      monthPosRev +
      monthExpRev;


    setText(
      'statInHouse',
      inHouseGuests.length
    );

    setText(
      'statFuture',
      futureBookings.length
    );

    setText(
      'statArrivals',
      arrivalsToday.length
    );

    setText(
      'statDailyRevenue',
      `$ ${dailyTotalRev.toFixed(2)}`
    );

    setText(
      'statMonthlyRevenue',
      `$ ${monthlyTotalRev.toFixed(2)}`
    );


    setText(
      'dashTodayRoom',
      `$ ${todayRoomRev.toFixed(2)}`
    );

    setText(
      'dashTodayPos',
      `$ ${todayPosRev.toFixed(2)}`
    );

    setText(
      'dashTodayExp',
      `$ ${todayExpRev.toFixed(2)}`
    );

    setText(
      'dashTodayTotal',
      `$ ${dailyTotalRev.toFixed(2)}`
    );


    setText(
      'dashMonthRoom',
      `$ ${monthRoomRev.toFixed(2)}`
    );

    setText(
      'dashMonthPos',
      `$ ${monthPosRev.toFixed(2)}`
    );

    setText(
      'dashMonthExp',
      `$ ${monthExpRev.toFixed(2)}`
    );

    setText(
      'dashMonthTotal',
      `$ ${monthlyTotalRev.toFixed(2)}`
    );


    const folioRate =
      window.currentGuest
        ? Number(
            window.currentGuest.rate || 0
          )
        : 0;


    setText(
      'folioAccomAmount',
      `$ ${folioRate.toFixed(2)}`
    );

    setText(
      'folioPosAmount',
      `$ ${todayPosRev.toFixed(2)}`
    );

    setText(
      'folioExpAmount',
      `$ ${todayExpRev.toFixed(2)}`
    );

    setText(
      'folioTotalBill',
      `$ ${
        (
          folioRate +
          todayPosRev +
          todayExpRev
        ).toFixed(2)
      }`
    );


    const cabinStatusBadge =
      document.getElementById(
        'cabinStatusBadge'
      );


    if (cabinStatusBadge) {

      if (inHouseGuests.length > 0) {

        cabinStatusBadge.innerText =
          'OCCUPIED';

        cabinStatusBadge.className =
          'px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold';

      } else {

        cabinStatusBadge.innerText =
          'VACANT';

        cabinStatusBadge.className =
          'px-3 py-1 bg-slate-400 text-white rounded-full text-xs font-bold';

      }

    }


  } catch (error) {

    console.error(
      'Dashboard error:',
      error
    );

  }

}


// ============================================================
// SMALL UI HELPER
// ============================================================

function setText(id, value) {

  const element =
    document.getElementById(id);

  if (element) {
    element.innerText = value;
  }

}


// ============================================================
// POSTING CHECK
// ============================================================

function isPostingAllowed() {

  if (
    !window.currentGuest ||
    (
      window.currentGuest.status !== 'in-house' &&
      window.currentGuest.status !== 'Checked In'
    )
  ) {

    alert(
      'Action Blocked: No guest is currently checked in. You cannot post charges to a vacant room or checked-out guest.'
    );

    return false;

  }

  return true;
}


// ============================================================
// QUICK EXPERIENCE
// ============================================================

async function quickAddExperience(title, price) {

  if (!isPostingAllowed()) {
    return;
  }


  try {

    const { error } =
      await supabase
        .from('experiences')
        .insert({

          name: title,

          amount: Number(price),

          date: getTodayString()

        });


    if (error) {
      throw error;
    }


    alert(
      `Added ${title} ($${price}) to active folio.`
    );


    await updateDashboard();


  } catch (error) {

    console.error(error);

    alert(
      'Could not add experience: ' +
      error.message
    );

  }

}

window.quickAddExperience =
  quickAddExperience;


// ============================================================
// POS CHECKOUT
// ============================================================

async function checkoutPos(type) {

  if (
    type === 'room' &&
    !isPostingAllowed()
  ) {
    return;
  }


  if (cart.length === 0) {

    alert(
      'Please add items to cart before checking out.'
    );

    return;
  }


  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        (
          item.price *
          item.qty
        ),
      0
    );


  try {

    const { error } =
      await supabase
        .from('pos_orders')
        .insert({

          items: cart,

          amount: total,

          date: getTodayString(),

          payment_method:
            type === 'room'
              ? 'Room Charge'
              : 'Direct Pay'

        });


    if (error) {
      throw error;
    }


    alert(
      `Payment of $${total} charged via ${
        type === 'room'
          ? 'Room Charge'
          : 'Direct Pay'
      }.`
    );


    cart = [];

    renderCart();

    await updateDashboard();


  } catch (error) {

    console.error(error);

    alert(
      'Could not save POS order: ' +
      error.message
    );

  }

}

window.checkoutPos = checkoutPos;


// ============================================================
// PRINT FOLIO INVOICE
// ============================================================

async function printFolioInvoice() {

  let activeRes =
    window.currentGuest;


  if (!activeRes) {

    const {
      data,
      error
    } =
      await supabase
        .from('reservations')
        .select('*')
        .order('id', {
          ascending: false
        });


    if (!error && data) {

      const reservations =
        data.map(
          mapReservationFromSupabase
        );


      const inHouseGuests =
        reservations.filter(r =>
          r.status === 'in-house' ||
          r.status === 'Checked In'
        );


      activeRes =
        inHouseGuests.length > 0
          ? inHouseGuests[
              inHouseGuests.length - 1
            ]
          : (
              reservations.length > 0
                ? reservations[0]
                : null
            );

    }

  }


  const guestName =
    activeRes
      ? activeRes.guestName
      : 'Valued Guest';


  const roomRate =
    activeRes
      ? Number(activeRes.rate || 0)
      : 0;


  const packageType =
    activeRes
      ? (
          activeRes.package ||
          activeRes.packageType ||
          'HB'
        )
      : 'HB';


  const selection =
    activeRes
      ? activeRes.selection
      : '2 adults';


  let posOrders = [];

  let experiences = [];


  const posResult =
    await supabase
      .from('pos_orders')
      .select('*');


  if (!posResult.error) {

    posOrders =
      (posResult.data || [])
        .map(mapPosOrderFromSupabase);

  }


  const expResult =
    await supabase
      .from('experiences')
      .select('*');


  if (!expResult.error) {

    experiences =
      (expResult.data || [])
        .map(mapExperienceFromSupabase);

  }


  let itemizedRows = '';

  let posTotal = 0;

  let expTotal = 0;


  itemizedRows += `
    <tr class="border-b">

      <td class="py-3 px-3 font-semibold text-slate-800">
        Accommodation (${packageType}) - ${selection}
      </td>

      <td class="py-3 px-3 text-center">
        1 Night
      </td>

      <td class="py-3 px-3 text-right font-bold">
        $ ${roomRate.toFixed(2)}
      </td>

    </tr>
  `;


  posOrders.forEach(order => {

    if (
      order.items &&
      Array.isArray(order.items)
    ) {

      order.items.forEach(item => {

        const lineCost =
          Number(item.price || 0) *
          Number(item.qty || 0);


        posTotal += lineCost;


        itemizedRows += `
          <tr class="border-b text-slate-700">

            <td class="py-2.5 px-3">
              🍽️ ${item.name}
            </td>

            <td class="py-2.5 px-3 text-center font-medium">
              x${item.qty}
            </td>

            <td class="py-2.5 px-3 text-right font-semibold">
              $ ${lineCost.toFixed(2)}
            </td>

          </tr>
        `;

      });

    }

  });


  experiences.forEach(exp => {

    const amt =
      Number(
        exp.amount ||
        exp.price ||
        0
      );


    expTotal += amt;


    itemizedRows += `
      <tr class="border-b text-slate-700">

        <td class="py-2.5 px-3">
          ⭐ ${exp.name || exp.title} (Add-on)
        </td>

        <td class="py-2.5 px-3 text-center font-medium">
          1
        </td>

        <td class="py-2.5 px-3 text-right font-semibold">
          $ ${amt.toFixed(2)}
        </td>

      </tr>
    `;

  });


  const grandTotal =
    roomRate +
    posTotal +
    expTotal;


  const printWindow =
    window.open(
      '',
      '_blank',
      'width=800,height=900'
    );


  if (!printWindow) {

    alert(
      'Pop-up blocked! Please allow pop-ups for this site to print invoices.'
    );

    return;

  }


  const baseUrl =
    window.location.href.substring(
      0,
      window.location.href.lastIndexOf('/') + 1
    );


  const logoSrc =
    `${baseUrl}wild-has%20logo.jpeg`;


  const invoiceHTML = `

    <!DOCTYPE html>

    <html>

    <head>

      <base href="${baseUrl}">

      <title>
        Itemized Guest Invoice - Wild Hasthi Resort
      </title>

      <script src="https://cdn.tailwindcss.com"></script>

    </head>

    <body class="p-8 bg-white text-slate-800 font-sans">

      <div class="max-w-2xl mx-auto border p-8 rounded-2xl shadow-sm">

        <div class="flex justify-between items-center border-b pb-6 mb-6">

          <div class="flex items-center gap-4">

            <img
              src="${logoSrc}"
              alt="Wild Hasthi Logo"
              class="h-24 w-auto object-contain"
              onError="this.style.display='none'; document.getElementById('logoFallback').style.display='block';"
            />

            <div
              id="logoFallback"
              style="display:none;"
              class="font-bold text-xl text-slate-800"
            >
              WILD HASTHI
            </div>

          </div>

          <div class="text-right">

            <h2 class="text-xl font-bold text-slate-800 uppercase tracking-wide">
              GUEST INVOICE
            </h2>

            <p class="text-xs text-slate-500 font-medium">
              Date: ${new Date().toLocaleDateString()}
            </p>

          </div>

        </div>


        <div class="grid grid-cols-2 gap-4 text-sm mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">

          <div>

            <p class="text-xs font-bold text-slate-400 uppercase">
              Guest Name
            </p>

            <p class="font-bold text-slate-800 text-base">
              ${guestName}
            </p>

          </div>

          <div>

            <p class="text-xs font-bold text-slate-400 uppercase">
              Room / Accommodation
            </p>

            <p class="font-bold text-slate-800 text-base">
              Cabin 01
            </p>

          </div>

        </div>


        <h3 class="text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">
          Itemized Folio Breakdown
        </h3>


        <table class="w-full text-left text-sm mb-6 border-collapse">

          <thead>

            <tr class="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">

              <th class="py-2.5 px-3">
                Item Description
              </th>

              <th class="py-2.5 px-3 text-center">
                Qty
              </th>

              <th class="py-2.5 px-3 text-right">
                Amount ($)
              </th>

            </tr>

          </thead>

          <tbody>
            ${itemizedRows}
          </tbody>

        </table>


        <div class="space-y-2 border-t-2 border-slate-900 pt-4 text-right">

          <div class="flex justify-between text-sm text-slate-600">

            <span>
              Base Room Package Rate:
            </span>

            <span>
              $ ${roomRate.toFixed(2)}
            </span>

          </div>


          <div class="flex justify-between text-sm text-slate-600">

            <span>
              Posted Restaurant & Snacks Subtotal:
            </span>

            <span>
              $ ${posTotal.toFixed(2)}
            </span>

          </div>


          <div class="flex justify-between text-sm text-slate-600">

            <span>
              Posted Tours & Experiences Subtotal:
            </span>

            <span>
              $ ${expTotal.toFixed(2)}
            </span>

          </div>


          <div class="flex justify-between items-center text-lg font-black text-slate-900 border-t pt-3">

            <span>
              Grand Total Payable:
            </span>

            <span class="text-emerald-700 text-xl">
              $ ${grandTotal.toFixed(2)}
            </span>

          </div>

        </div>


        <div class="mt-12 text-center text-xs text-slate-400 border-t pt-4">

          <p>
            Thank you for staying at Wild Hasthi Luxury Retreat - Sri Lanka!
          </p>

        </div>

      </div>


      <script>

        window.onload = function() {

          setTimeout(() => {

            window.print();

          }, 300);

        }

      </script>


    </body>

    </html>

  `;


  printWindow.document.write(
    invoiceHTML
  );

  printWindow.document.close();

}

window.printFolioInvoice =
  printFolioInvoice;


// ============================================================
// FINAL CHECKOUT
// ============================================================

async function performFinalCheckout() {

  let activeRes =
    window.currentGuest;


  if (!activeRes) {

    const {
      data,
      error
    } =
      await supabase
        .from('reservations')
        .select('*')
        .order('id', {
          ascending: false
        });


    if (!error && data) {

      const reservations =
        data.map(
          mapReservationFromSupabase
        );


      const inHouseGuests =
        reservations.filter(r =>
          r.status === 'in-house' ||
          r.status === 'Checked In'
        );


      if (inHouseGuests.length > 0) {

        activeRes =
          inHouseGuests[
            inHouseGuests.length - 1
          ];

      }

    }

  }


  if (!activeRes) {

    alert(
      'No active guest found to check out.'
    );

    return;

  }


  if (
    activeRes.status === 'checked-out' ||
    activeRes.status === 'Checked Out'
  ) {

    alert(
      'Guest is already checked out.'
    );

    return;

  }


  if (!confirm(
    `Are you sure you want to check out ${activeRes.guestName} and print the final invoice?`
  )) {

    return;

  }


  const { error } =
    await supabase
      .from('reservations')
      .update({
        status: 'checked-out'
      })
      .eq('id', Number(activeRes.id));


  if (error) {

    console.error(error);

    alert(
      'Could not complete checkout: ' +
      error.message
    );

    return;

  }


  window.currentGuest = null;


  await updateDashboard();

  await loadReservations();


  await printFolioInvoice();


  alert(
    'Guest checked out successfully! The bill is finalized and status updated to Checked Out.'
  );

}

window.performFinalCheckout =
  performFinalCheckout;


// ============================================================
// CANCEL BOOKING
// ============================================================

async function cancelBooking(id) {

  if (!confirm(
    'Are you sure you want to cancel this booking?'
  )) {

    return;

  }


  const { error } =
    await supabase
      .from('reservations')
      .update({
        status: 'cancelled'
      })
      .eq('id', Number(id));


  if (error) {

    console.error(error);

    alert(
      'Could not cancel booking: ' +
      error.message
    );

    return;

  }


  if (
    window.currentGuest &&
    window.currentGuest.id === Number(id)
  ) {

    window.currentGuest = null;

  }


  await updateDashboard();

  await loadReservations();


  alert(
    'Booking has been cancelled.'
  );

}

window.cancelBooking = cancelBooking;


// ============================================================
// RESERVATION ROW
// ============================================================

function renderReservationRow(res) {

  const statusColors = {

    'in-house':
      'bg-emerald-100 text-emerald-800',

    'Checked In':
      'bg-emerald-100 text-emerald-800',

    'future':
      'bg-blue-100 text-blue-800',

    'Confirmed':
      'bg-blue-100 text-blue-800',

    'checked-out':
      'bg-slate-100 text-slate-700',

    'Checked Out':
      'bg-slate-100 text-slate-700',

    'cancelled':
      'bg-rose-100 text-rose-800',

    'Cancelled':
      'bg-rose-100 text-rose-800'

  };


  const badgeColor =
    statusColors[res.status] ||
    'bg-slate-100 text-slate-600';


  const isCheckedOut =
    res.status === 'checked-out' ||
    res.status === 'Checked Out';


  const isCancelled =
    res.status === 'cancelled' ||
    res.status === 'Cancelled';


  let actionButtons = '';


  if (
    isCheckedOut ||
    isCancelled
  ) {

    actionButtons = `

      <button
        onclick="reopenBooking(${res.id})"
        class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition">

        Unlock

      </button>

    `;

  }

  else if (
    res.status === 'Confirmed' ||
    res.status === 'future'
  ) {

    actionButtons = `

      <button
        onclick="checkInGuest(${res.id})"
        class="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold transition">

        Check In

      </button>

      <button
        onclick="cancelBooking(${res.id})"
        class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition">

        Cancel

      </button>

    `;

  }

  else if (
    res.status === 'Checked In' ||
    res.status === 'in-house'
  ) {

    actionButtons = `

      <button
        onclick="checkoutGuestDirect(${res.id})"
        class="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[10px] font-bold transition">

        Check Out

      </button>

      <button
        onclick="cancelBooking(${res.id})"
        class="px-2.5 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold transition">

        Cancel

      </button>

    `;

  }


  return `

    <tr class="hover:bg-slate-50 transition border-b border-slate-100">

      <td class="p-4 font-bold text-slate-800">
        ${res.guestName || ''}
      </td>

      <td class="p-4 text-slate-600 text-xs">
        ${res.checkIn || ''} to ${res.checkOut || ''}
      </td>

      <td class="p-4 text-slate-600 text-xs capitalize">
        ${res.selection || ''}
      </td>

      <td class="p-4 text-slate-600 text-xs">
        ${res.package || res.packageType || ''}
      </td>

      <td class="p-4 font-bold text-slate-800">
        $${Number(res.rate || 0).toFixed(2)}
      </td>

      <td class="p-4">

        <span
          class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${badgeColor}">

          ${res.status}

        </span>

      </td>

      <td class="p-4 text-center">

        <div class="flex items-center justify-center gap-1">

          ${actionButtons}

          <button
            onclick="deleteBooking(${res.id})"
            class="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 rounded-lg text-[10px] font-bold transition"
            title="Delete Booking Permanently">

            <i class="fa-solid fa-trash"></i>
            Delete

          </button>

        </div>

      </td>

    </tr>

  `;

}


// ============================================================
// DELETE BOOKING
// ============================================================

async function deleteBooking(id) {

  if (!confirm(
    'Are you sure you want to PERMANENTLY delete this booking?'
  )) {

    return;

  }


  try {

    const { error } =
      await supabase
        .from('reservations')
        .delete()
        .eq('id', Number(id));


    if (error) {
      throw error;
    }


    if (
      window.currentGuest &&
      window.currentGuest.id === Number(id)
    ) {

      window.currentGuest = null;

    }


    await loadReservations();

    await updateDashboard();


    alert(
      'Booking deleted successfully.'
    );


  } catch (error) {

    console.error(
      'Delete error:',
      error
    );

    alert(
      'Could not delete record from database: ' +
      error.message
    );

  }

}

window.deleteBooking = deleteBooking;


// ============================================================
// END
// ============================================================