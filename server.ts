import "dotenv/config";
import createApp from "./src/app";

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ARTMO server listening on port ${PORT}`);
  });
}

export default app;
