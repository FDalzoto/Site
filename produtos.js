
const WHATSAPP_NUMBER = "5542984410430";

const productGrid = document.getElementById("product-grid");
const searchInput = document.getElementById("product-search");
const categoryFilters = document.getElementById("category-filters");
const emptyState = document.getElementById("empty-state");
const cartCount = document.getElementById("cart-count");
const clearCartButton = document.getElementById("clear-cart");
const sendOrderButton = document.getElementById("send-order");

const cart = new Map();

let products = [];
let selectedCategory = "Todos";
let carregando = true;
let erroCarregamento = false;

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[character]));
}

function formatPrice(product) {
    const price = Number(product.price);

    if (
        product.price !== null &&
        product.price !== "" &&
        Number.isFinite(price) &&
        price >= 0
    ) {
        return price.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    return "Consultar preço";
}

function renderCategories() {
    const categories = [
        "Todos",
        ...new Set(
            products
                .map(product => product.category)
                .filter(Boolean)
        )
    ];

    if (!categories.includes(selectedCategory)) {
        selectedCategory = "Todos";
    }

    categoryFilters.innerHTML = categories.map(category => `
        <button
            type="button"
            data-category="${escapeHTML(category)}"
            class="${category === selectedCategory ? "active" : ""}"
            aria-pressed="${category === selectedCategory}"
        >
            ${escapeHTML(category)}
        </button>
    `).join("");
}

function renderProducts() {
    if (carregando) {
        productGrid.innerHTML = "<p>Carregando produtos...</p>";
        emptyState.hidden = true;
        updateCart();
        return;
    }

    if (erroCarregamento) {
        productGrid.innerHTML = `
            <p>Não foi possível carregar os produtos.
            Tente novamente em instantes.</p>
            <button type="button" id="retry-products">
                Tentar novamente
            </button>
        `;

        emptyState.hidden = true;
        updateCart();
        return;
    }

    const searchTerm = searchInput.value
        .trim()
        .toLocaleLowerCase("pt-BR");

    const filteredProducts = products.filter(product => {
        const matchesCategory =
            selectedCategory === "Todos" ||
            product.category === selectedCategory;

        const searchableText = [
            product.name,
            product.category,
            product.description
        ].join(" ").toLocaleLowerCase("pt-BR");

        return matchesCategory &&
            searchableText.includes(searchTerm);
    });

    productGrid.innerHTML = filteredProducts.map(product => {
        const quantity = cart.get(product.id) || 0;
        const stock = Number(product.stock);
        const hasStock = Number.isFinite(stock) && stock > 0;
        const canAdd = hasStock && quantity < stock;

        return `
            <article class="product-card">
                <div class="product-image-wrap">
                    <img
                        class="product-image"
                        src="${escapeHTML(product.image || "https://placehold.co/700x500/edf4ec/14532d?text=Produto")}"
                        alt="${escapeHTML(product.name)}"
                        loading="lazy"
                    >

                    <span class="product-category">
                        ${escapeHTML(product.category || "Outros")}
                    </span>
                </div>

                <div class="product-info">
                    <h3>${escapeHTML(product.name)}</h3>

                    <p class="product-description">
                        ${escapeHTML(product.description || "Consulte mais informações sobre este produto.")}
                    </p>

                    <div class="product-price">
                        ${escapeHTML(formatPrice(product))}
                        <small>
                            ${hasStock
                                ? `Estoque informado: ${stock}`
                                : "Produto indisponível no momento"}
                        </small>
                    </div>

                    <div class="product-actions">
                        <button
                            class="add-button ${quantity ? "selected" : ""}"
                            type="button"
                            data-add="${product.id}"
                            ${canAdd ? "" : "disabled"}
                        >
                            ${!hasStock
                                ? "Sem estoque"
                                : quantity >= stock
                                    ? "Limite do estoque atingido"
                                    : quantity
                                        ? `Adicionar mais (${quantity})`
                                        : "Adicionar ao pedido"}
                        </button>

                        ${quantity ? `
                            <button
                                class="remove-button"
                                type="button"
                                data-remove="${product.id}"
                            >
                                Remover
                            </button>
                        ` : ""}
                    </div>
                </div>
            </article>
        `;
    }).join("");

    emptyState.hidden = filteredProducts.length !== 0;

    productGrid.querySelectorAll(".product-image").forEach(image => {
        image.addEventListener("error", () => {
            image.src =
                "https://www.petlove.com.br/images/products/234533/product/Ra%C3%A7%C3%A3o_Seca_Dog_Excellence_Carne_e_Arroz_para_C%C3%A3es_Adultos_Ra%C3%A7as_Grandes_310118831_1.jpg?1770791350";
        }, { once: true });
    });

    updateCart();
}

function updateCart() {
    let totalItems = 0;

    for (const quantity of cart.values()) {
        totalItems += quantity;
    }

    cartCount.textContent = totalItems;
    sendOrderButton.disabled = totalItems === 0;
}

async function loadProducts() {
    carregando = true;
    erroCarregamento = false;
    renderProducts();

    try {
        const response = await fetch("/api/produtos");

        if (!response.ok) {
            throw new Error("Falha ao consultar a API.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Resposta inválida da API.");
        }

        products = data.map(product => ({
            id: Number(product.id),
            name: product.nome,
            category: product.categoria || "Outros",
            description: product.descricao || "",
            price: product.preco,
            stock: Number(product.estoque),
            image: product.imagem || ""
        }));

        const validIds = new Set(products.map(product => product.id));

        for (const id of cart.keys()) {
            if (!validIds.has(id)) {
                cart.delete(id);
            }
        }

        renderCategories();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        erroCarregamento = true;
    } finally {
        carregando = false;
        renderProducts();
    }
}

productGrid.addEventListener("click", event => {
    if (event.target.closest("#retry-products")) {
        loadProducts();
        return;
    }

    const addButton = event.target.closest("[data-add]");
    const removeButton = event.target.closest("[data-remove]");

    if (addButton) {
        const id = Number(addButton.dataset.add);
        const product = products.find(item => item.id === id);

        if (!product) return;

        const quantity = cart.get(id) || 0;

        if (quantity < product.stock) {
            cart.set(id, quantity + 1);
            renderProducts();
        }
    }

    if (removeButton) {
        const id = Number(removeButton.dataset.remove);
        const quantity = cart.get(id) || 0;

        if (quantity <= 1) {
            cart.delete(id);
        } else {
            cart.set(id, quantity - 1);
        }

        renderProducts();
    }
});

searchInput.addEventListener("input", renderProducts);

categoryFilters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");

    if (!button) return;

    selectedCategory = button.dataset.category;

    categoryFilters.querySelectorAll("[data-category]")
        .forEach(categoryButton => {
            const active =
                categoryButton.dataset.category === selectedCategory;

            categoryButton.classList.toggle("active", active);
            categoryButton.setAttribute("aria-pressed", String(active));
        });

    renderProducts();
});

clearCartButton.addEventListener("click", () => {
    cart.clear();
    renderProducts();
});

sendOrderButton.addEventListener("click", () => {
    const selectedProducts = products.filter(product =>
        cart.has(product.id)
    );

    if (selectedProducts.length === 0) return;

    const orderLines = selectedProducts.map(product => {
        const quantity = cart.get(product.id);

        return `- ${product.name} | Quantidade: ${quantity} | ${formatPrice(product)}`;
    });

    const message = [
        "Olá! Gostaria de consultar os seguintes produtos da Campos Gerais:",
        "",
        ...orderLines,
        "",
        "Poderiam confirmar os preços finais e a disponibilidade?"
    ].join("\n");

    const whatsappURL =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(whatsappURL, "_blank", "noopener,noreferrer");
});

renderCategories();
renderProducts();
loadProducts();
