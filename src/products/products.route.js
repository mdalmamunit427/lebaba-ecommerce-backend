const express = require("express");
const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");
const router = express.Router();

// post a product
router.post("/create-product", async (req, res) => {
  try {
    const { name } = req.body;

    // Create a new product instance
    const newProduct = new Products({
      ...req.body,
    });

    const savedProduct = await newProduct.save();

    // Calculate the average rating
    const reviews = await Reviews.find({ productId: savedProduct._id });
    if (reviews.length > 0) {
      const totalRating = reviews.reduce(
        (acc, review) => acc + review.rating,
        0
      );
      const averageRating = totalRating / reviews.length;
      savedProduct.rating = averageRating;
      await savedProduct.save();
    }

    res.status(201).json(savedProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Failed to create product" });
  }
});

// Get all posts (public route)
router.get("/", async (req, res) => {
  try {
    const { category, color, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (category && category !== "all") {
      filter.category = category;
    }

    if (color && color !== "all") {
      filter.color = color;
    }

    if (minPrice && maxPrice) {
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      if (!isNaN(min) && !isNaN(max)) {
        filter.price = { $gte: min, $lte: max };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalProducts = await Products.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / parseInt(limit));

    const products = await Products.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "email")
      .sort({ createdAt: -1 });

    res.status(200).send({ products, totalPages, totalProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send({ message: "Failed to fetch products" });
  }
});


// Get single post (public route)
router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    // console.log(postId)

    const product = await Products.findById(productId).populate(
      "author",
      "email username"
    );
    // console.log(post)

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const reviews = await Reviews.find({ productId }).populate(
      "userId",
      "username email"
    );

    res.status(200).send({ product, reviews });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).send({ message: "Failed to fetch post" });
  }
});

// update a post (protected route)
router.patch("/update-product/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    // const { title, content, category } = req.body;
    const updatedProduct = await Products.findByIdAndUpdate(
      productId,
      { ...req.body },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).send({ message: "Product not found" });
    }

    res
      .status(200)
      .send({
        message: "Product updated successfully",
        product: updatedProduct,
      });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).send({ message: "Failed to fetch product" });
  }
});

// delete a post with the related comment
router.delete("/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    // Find and delete the products collection
    const deletedProduct = await Products.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).send({ message: "Post not found" });
    }

    // Delete associated comments
    await Reviews.deleteMany({ productId: productId });

    res
      .status(200)
      .send({
        message: "Product and associated comments deleted successfully",
      });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send({ message: "Failed to delete post" });
  }
});

// related products
router.get("/related/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is defined
    if (!id) {
      return res.status(400).send({ message: "Product ID is required" });
    }

    // Find the product by ID
    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    // Create a regex pattern for partial matching of the product name
    const titleRegex = new RegExp(
      product.name
        .split(" ")
        .filter((word) => word.length > 1)
        .join("|"),
      "i"
    );

    // Find related products that match either the name or category, excluding the current product
    const relatedProducts = await Products.find({
      _id: { $ne: id }, // Exclude the current product
      $or: [
        { name: { $regex: titleRegex } }, // Match similar names
        { category: product.category }, // Match the same category
      ],
    });

    res.status(200).send(relatedProducts);
  } catch (error) {
    console.error("Error fetching related products:", error);
    res.status(500).send({ message: "Failed to fetch related products" });
  }
});

module.exports = router;
