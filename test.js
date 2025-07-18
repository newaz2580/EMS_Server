require("dotenv").config();


const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);



(async () => {

//     {
//   id: 'pi_3Rm6vBITYy32hWQk1pE8CslP',
//   object: 'payment_intent',
//   amount: 5000,
//   amount_capturable: 0,
//   amount_details: { tip: {} },      
//   amount_received: 0,
//   application: null,
//   application_fee_amount: null,     
//   automatic_payment_methods: null,
//   canceled_at: null,
//   cancellation_reason: null,
//   capture_method: 'automatic_async',
//   client_secret: 'pi_3Rm6vBITYy32hWQk1pE8CslP_secret_7hxwvdQOOhsR8GfBJ5lByuU6A',
//   confirmation_method: 'automatic',
//   created: 1752816805,
//   currency: 'usd',
//   customer: null,
//   description: null,
//   last_payment_error: null,
//   latest_charge: null,
//   livemode: false,
//   metadata: {},
//   next_action: null,
//   on_behalf_of: null,
//   payment_method: null,
//   payment_method_configuration_details: null,
//   payment_method_options: {
//     card: {
//       installments: null,
//       mandate_options: null,
//       network: null,
//       request_three_d_secure: 'automatic'
//     }
//   },
//   payment_method_types: [ 'card' ],
//   processing: null,
//   receipt_email: null,
//   review: null,
//   setup_future_usage: null,
//   shipping: null,
//   source: null,
//   statement_descriptor: null,
//   statement_descriptor_suffix: null,
//   status: 'requires_payment_method',
//   transfer_data: null,
//   transfer_group: null
// }

//   const paymentIntent = await stripe.paymentIntents.create({
//           amount: 5000,
//           currency: "usd",
//           payment_method_types: ["card"],
//         });


 const paymentIntent = await stripe.paymentIntents.retrieve('pi_3Rm6vBITYy32hWQk1pE8CslP');

        console.log(paymentIntent)

})();