import './globals.css';
import Header from '../components/Header';

export const metadata = {
  title: "Daily Food Choice",
  description: "Choose your kid's daily food menu",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <Header />
        </header>
        <main className="container">{children}</main>
        <footer className="footer">© {new Date().getFullYear()} Daily Food Choice (By a proud Sedgwick parent)</footer>
      </body>
    </html>
  );
}
